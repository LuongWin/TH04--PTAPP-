package com.chatfirebase

import android.content.Intent
import android.os.SystemClock
import android.os.ParcelFileDescriptor
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.Configurator
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import androidx.test.uiautomator.Until
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream

/** Persistent device-side runner lets the host coordinate two real app instances. */
@RunWith(AndroidJUnit4::class)
class ChatDeviceTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val device = UiDevice.getInstance(instrumentation)

  private fun writeArtifact(path: String, value: String) {
    // UiAutomation executes a program directly; shell quoting, pipes and redirection
    // are not interpreted. Feed the file contents through the command's stdin.
    val streams = instrumentation.uiAutomation.executeShellCommandRw("tee $path.tmp")
    ParcelFileDescriptor.AutoCloseOutputStream(streams[1]).use {
      it.write(value.toByteArray(Charsets.UTF_8))
    }
    ParcelFileDescriptor.AutoCloseInputStream(streams[0]).use { it.readBytes() }
    device.executeShellCommand("mv $path.tmp $path")
  }

  private fun snapshot(directory: String, prefix: String) {
    device.executeShellCommand("screencap -p $directory/$prefix.png")
    val output = ByteArrayOutputStream()
    device.dumpWindowHierarchy(output)
    writeArtifact("$directory/$prefix.xml", output.toString("UTF-8"))
  }

  private fun selector(command: JSONObject): BySelector = when {
    command.has("id") -> By.res(command.getString("id"))
    command.has("desc") -> By.desc(command.getString("desc"))
    command.has("descPrefix") -> By.descStartsWith(command.getString("descPrefix"))
    command.has("textContains") -> By.textContains(command.getString("textContains"))
    else -> By.text(command.getString("text"))
  }

  private fun element(command: JSONObject): UiObject2 {
    device.runWatchers()
    val by = selector(command)
    var found = device.wait(Until.findObject(by), 1200)
    if (found == null && command.optBoolean("scroll", true)) {
      try {
        val target = when {
          command.has("id") -> UiSelector().resourceId(command.getString("id"))
          command.has("desc") -> UiSelector().description(command.getString("desc"))
          else -> UiSelector().text(command.optString("text"))
        }
        UiScrollable(UiSelector().scrollable(true)).setMaxSearchSwipes(8).scrollIntoView(target)
      } catch (_: Exception) { /* A later bounded wait reports the missing target. */ }
      found = device.wait(Until.findObject(by), command.optLong("timeout", 12000))
    }
    return found ?: throw AssertionError("Element not found: $command")
  }

  private fun launch() {
    val context = instrumentation.targetContext
    val intent = context.packageManager.getLaunchIntentForPackage("com.chatfirebase")!!
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    context.startActivity(intent)
    device.wait(Until.hasObject(By.pkg("com.chatfirebase")), 15000)
  }

  @Test
  fun coordinatedChatScenario() {
    val runId = InstrumentationRegistry.getArguments().getString("qaRun") ?: "manual"
    require(runId.matches(Regex("[a-z0-9-]+")))
    // Shell-owned artifacts survive target-app reinstalls without stale app-UID permissions.
    val directory = "/sdcard/Download/chatfirebase-qa/$runId"
    device.executeShellCommand("mkdir -p $directory")
    Configurator.getInstance().waitForIdleTimeout = 500
    device.registerWatcher("system-ui-wait") {
      val dialog = device.findObject(By.text("System UI isn't responding"))
      val wait = device.findObject(By.text("Wait"))
      if (dialog != null && wait != null) { wait.click(); true } else false
    }
    device.wakeUp()
    device.runWatchers()
    launch()
    writeArtifact("$directory/ready.json", "{\"ready\":true}")
    var sequence = 1
    var failures = 0
    var stopped = false
    val deadline = SystemClock.elapsedRealtime() + 15 * 60 * 1000
    while (!stopped && SystemClock.elapsedRealtime() < deadline) {
      val input = "$directory/command-$sequence.json"
      val payload = device.executeShellCommand("cat $input")
      if (!payload.trimStart().startsWith("{")) { SystemClock.sleep(250); continue }
      val result = JSONObject().put("sequence", sequence)
      try {
        val command = JSONObject(payload)
        when (command.getString("op")) {
          "state" -> {
            val end = SystemClock.elapsedRealtime() + 20000
            while (!device.hasObject(By.res("login-submit")) && !device.hasObject(By.res("tab-settings")) && SystemClock.elapsedRealtime() < end) {
              device.runWatchers()
              SystemClock.sleep(200)
            }
            result.put("signedIn", device.hasObject(By.res("tab-settings")))
            result.put("login", device.hasObject(By.res("login-submit")))
          }
          "tap" -> element(command).click()
          "type" -> element(command).text = command.getString("value")
          "assert" -> {
            val end = SystemClock.elapsedRealtime() + command.optLong("timeout", 20000)
            var actual = ""
            var matched = false
            do {
              device.runWatchers()
              val target = device.findObject(selector(command))
              actual = target?.text ?: target?.contentDescription ?: ""
              matched = target != null && when {
                command.has("enabled") -> target.isEnabled == command.getBoolean("enabled")
                command.has("expected") -> actual == command.getString("expected")
                command.has("contains") -> actual.contains(command.getString("contains"))
                command.has("notContains") -> !actual.contains(command.getString("notContains"))
                else -> true
              }
              if (!matched) SystemClock.sleep(200)
            } while (!matched && SystemClock.elapsedRealtime() < end)
            assertTrue("Assertion failed: $command; actual=$actual", matched)
            result.put("actual", actual)
          }
          "absent" -> assertTrue("Unexpected element: $command", device.wait(Until.gone(selector(command)), 8000))
          "count" -> assertEquals(command.getInt("count"), device.findObjects(selector(command)).size)
          "home" -> device.pressHome()
          "back" -> device.pressBack()
          "launch" -> launch()
          "snapshot" -> {
            snapshot(directory, "screen-$sequence")
            result.put("image", "$directory/screen-$sequence.png")
          }
          "stop" -> stopped = true
          else -> throw AssertionError("Unsupported QA operation")
        }
        result.put("ok", true)
      } catch (failure: Throwable) {
        failures++
        result.put("ok", false).put("error", failure.message ?: failure.javaClass.name)
        snapshot(directory, "failure-$sequence")
      }
      writeArtifact("$directory/result-$sequence.json", result.toString())
      sequence++
    }
    assertTrue("Host did not finish the scenario", stopped)
    assertEquals("Device actions failed", 0, failures)
  }
}
