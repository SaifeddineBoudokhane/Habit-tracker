#!/usr/bin/env bash
# Runs inside the emulator job: install the APK, run every Maestro flow, collect evidence.
set -u
mkdir -p e2e-out/shots
# Hide system "isn't responding" dialogs (e.g. the emulator's launcher) so they can't cover the app.
adb shell settings put global hide_error_dialogs 1 || true
adb shell settings put secure anr_show_background 0 || true
# Let the freshly booted emulator settle before driving it.
adb shell input keyevent KEYCODE_HOME || true
sleep 20
adb install -r habit-tracker-x86_64.apk
adb logcat -c
cd e2e-out
status=0
for f in ../e2e/0*.yaml; do
  name=$(basename "$f" .yaml)
  echo "::group::$name"
  # Each flow relaunches the app with clearState. If the previous flow's app is still being torn down,
  # the emulator can kill the new process mid-start ("Destroy timeout of remove-task"), leaving the
  # splash screen up forever. Stop the app and let it settle first, and give a failed flow one retry
  # so that emulator hiccup doesn't fail the build. A real bug fails both times.
  adb shell am force-stop com.saifeddine.habittracker || true
  sleep 3
  if "$HOME/.maestro/bin/maestro" test "$f" --debug-output "debug-$name"; then
    echo "PASS $name" | tee -a summary.txt
  elif { echo "Retrying $name"; adb shell am force-stop com.saifeddine.habittracker; sleep 5; } &&
    "$HOME/.maestro/bin/maestro" test "$f" --debug-output "debug-$name-retry"; then
    echo "PASS $name (on retry)" | tee -a summary.txt
  else
    echo "FAIL $name" | tee -a summary.txt
    status=1
  fi
  echo "::endgroup::"
done
# takeScreenshot paths can resolve next to the flow files or the working dir: gather both.
cp ../e2e/shots/*.png shots/ 2>/dev/null || true
# Failure screenshots from Maestro's debug output.
# Flow screenshots (takeScreenshot) keep their names; Maestro's own failure captures get a fail- prefix.
find . -path '*debug-*' -path '*/shots/*' -name '*.png' -exec cp {} shots/ \; 2>/dev/null || true
find . -path '*debug-*' -path '*/screenshots/*' -name '*.png' -exec sh -c 'cp "$1" "shots/fail-$(basename "$1")"' _ {} \; 2>/dev/null || true
adb logcat -d -v time ReactNativeJS:V ReactNative:V AndroidRuntime:E '*:S' > logcat.txt || true
cat summary.txt
exit $status
