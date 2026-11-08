# Regenerates src/constants/icons.ts from Material Symbols (Apache-2.0).
# Usage:
#   npm pack @material-symbols/svg-400 && tar xzf material-symbols-svg-400-*.tgz
#   python3 scripts/gen-icons.py package/rounded src/constants/icons.ts
# Add a name to UI or HABIT below (key:material_name, or habit icon name:Label). Never rename a HABIT key: habits store it.
import re, sys, os
src = sys.argv[1]; out = sys.argv[2]
UI = """today:task_alt today-fill:check_circle-fill habits:checklist workouts:fitness_center stats:bar_chart settings:settings settings-fill:settings-fill
add close check remove chevron_left chevron_right keyboard_arrow_down keyboard_arrow_right arrow_upward arrow_downward swap_vert edit delete more_vert
notifications streak:local_fire_department streak-fill:local_fire_department-fill shield shield-fill trophy timer play_arrow stop schedule calendar_today
morning:wb_twilight afternoon:sunny evening:bedtime anytime:schedule spa celebration lock fingerprint folder backup download upload widgets restart_alt
trending_up event_repeat skip_next history undo flag archive unarchive notes:edit_note list:format_list_bulleted info warning share notifications_off alarm sync""".split()
HABIT = """check_circle:Done water_drop:Water local_drink:Drink menu_book:Read auto_stories:Study directions_run:Run directions_walk:Walk steps:Steps
fitness_center:Gym sports_gymnastics:Stretch self_improvement:Meditate spa:Relax bedtime:Sleep dentistry:Teeth medication:Medicine pill:Vitamins
smoke_free:No smoking no_drinks:No alcohol cookie:Sweets mobile_off:No phone edit_note:Journal ink_pen:Write music_note:Music piano:Piano
cleaning_services:Clean nutrition:Eat well restaurant:Cook local_cafe:Coffee pedal_bike:Cycle pool:Swim hiking:Hike sports_soccer:Sport
school:Learn translate:Language code:Code brush:Create palette:Art volunteer_activism:Pray favorite:Health psychology:Mind savings:Save money
work:Work potted_plant:Plants sunny:Sunlight flag:Goal target:Focus""".split('\n')
def path(name):
    f = os.path.join(src, name + '.svg')
    d = re.findall(r'<path d="([^"]+)"', open(f).read())
    assert len(d) == 1, name
    return d[0]
lines = ["// Generated from Material Symbols Rounded (weight 400), Apache License 2.0 — https://fonts.google.com/icons",
         "// Single-path glyphs in a 0 -960 960 960 viewBox. Shared by the app (react-native-svg) and the widgets (SvgWidget).",
         "", "export const UI_ICONS = {"]
for tok in UI:
    key, _, mat = tok.partition(':'); mat = mat or key
    lines.append(f"  '{key}': '{path(mat)}',")
lines += ["} as const;", "", "/** Icons a habit can use, in picker order. Keys are stored on the habit, so never rename one. */",
          "export const HABIT_ICONS = {"]
toks = re.findall(r'(\w+):([A-Za-z][A-Za-z ]*?)(?=\s+\w+:|$)', ' '.join(HABIT))
for key, label in toks:
    lines.append(f"  {key}: {{ label: '{label.strip()}', d: '{path(key)}' }},")
lines += ["} as const;", ""]
open(out, 'w').write('\n'.join(lines))
print(len(UI), 'ui', len(toks), 'habit')
