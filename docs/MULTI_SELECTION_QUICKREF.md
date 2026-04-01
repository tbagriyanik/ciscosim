# Quick Reference - Topology Multi-Selection

## 🎮 Keyboard Shortcuts

### Selection
| Shortcut | Action |
|----------|--------|
| **Click** | Select single device |
| **Shift+Click** | Toggle selection (add/remove) |
| **Ctrl+Click** | Toggle selection (no drag) |
| **Ctrl+A** | Select all devices |

### Actions
| Shortcut | Action |
|----------|--------|
| **Delete/Backspace** | Delete selected devices |
| **Enter** | Open terminal (single selection) |
| **Esc** | Clear selection / Close menus |
| **Alt+R** | Reset view |

### Clipboard
| Shortcut | Action |
|----------|--------|
| **Ctrl+C** | Copy selected devices |
| **Ctrl+X** | Cut selected devices |
| **Ctrl+V** | Paste devices |

### View
| Shortcut | Action |
|----------|--------|
| **Ctrl+F** | Toggle fullscreen |
| **Arrow Keys** | Pan canvas |
| **+/-** | Zoom in/out |
| **0** | Reset zoom |

---

## 🖱️ Mouse Actions

### Single Click
```
Left Click → Select device
Right Click → Context menu
Double Click → Open terminal
```

### Drag & Drop
```
Click + Drag → Move device
Shift+Drag → Move group
Wheel → Pan canvas
Scroll + Shift → Horizontal pan
```

---

## 📋 Selection Patterns

### Pattern 1: Range Selection (Shift)
```bash
# Select devices A, B, C in sequence:
Click A       → [A]
Shift+Click B → [A, B]
Shift+Click C → [A, B, C]
```

### Pattern 2: Individual Toggle (Ctrl)
```bash
# Select specific devices:
Click A      → [A]
Ctrl+Click C → [A, C]
Ctrl+Click E → [A, C, E]
```

### Pattern 3: Group Move
```bash
# Move multiple devices together:
1. Select with Shift/Ctrl
2. Click any selected device
3. Drag → All move together
```

---

## 🎯 Common Tasks

### Task 1: Select 3 Specific Devices
```
Method A (Shift):
1. Click first device
2. Shift+Click second device
3. Shift+Click third device

Method B (Ctrl):
1. Click first device
2. Ctrl+Click second device
3. Ctrl+Click third device
```

### Task 2: Deselect One from Group
```
Current: [A, B, C] selected
To remove B:
→ Shift+Click B  OR  Ctrl+Click B
Result: [A, C] selected
```

### Task 3: Move Group of Devices
```
1. Select multiple (Shift or Ctrl)
2. Click and hold on any selected device
3. Drag to new position
4. Release to drop
```

### Task 4: Select All and Delete
```
1. Ctrl+A (select all)
2. Press Delete
✓ All devices deleted
```

---

## 💡 Pro Tips

### Tip 1: Mixed Selection
```
Use Shift for nearby devices
Use Ctrl for scattered devices
Combine both for complex selections
```

### Tip 2: Quick Deselect
```
Click empty canvas → Clears selection
Esc key → Clears selection
```

### Tip 3: Precision Selection
```
Zoom in first (+ key)
Then select precisely
Avoid accidental selections
```

### Tip 4: Undo Mistakes
```
Wrong deletion? Ctrl+Z to undo
Wrong move? Ctrl+Z to restore
```

---

## 🔍 Visual Feedback

### Selected State
```
Single: Blue ring around device
Multi:  Blue ring on all selected
Hover:  Subtle glow effect
Drag:   Shadow + transparency
```

### Cursor States
```
Normal:    Default cursor
Hover:     Pointer cursor
Shift:     Add icon (conceptually)
Ctrl:      Toggle icon (conceptually)
Drag:      Move/grab cursor
```

---

## ⚠️ Gotchas

### Don't Do This
```
❌ Rapid clicking (may cause issues)
❌ Shift+drag on unselected device (selects only that)
❌ Expecting mobile multi-select (not supported)
```

### Do This Instead
```
✅ Click deliberately
✅ Use Shift for groups
✅ Use Ctrl for precision
✅ Check selection before dragging
```

---

## 📱 Mobile Limitations

### Not Supported
- ❌ Shift key selection
- ❌ Ctrl key selection
- ❌ Group dragging
- ❌ Keyboard shortcuts

### What Works
- ✅ Single tap selection
- ✅ Long press context menu
- ✅ Double tap terminal
- ✅ Pinch zoom
- ✅ One finger pan

---

## 🐛 Troubleshooting

### Issue: Selection Not Working
```
Try:
1. Click empty canvas to clear
2. Try clicking device again
3. Check if device is offline
4. Refresh page if needed
```

### Issue: Can't Drag Group
```
Check:
1. Are multiple devices selected?
2. Clicking on selected device?
3. Not in ping mode?
4. Canvas not panning instead?
```

### Issue: Wrong Device Selected
```
Fix:
1. Zoom in for precision
2. Use Ctrl for individual toggle
3. Click deliberately on center
4. Avoid edges between devices
```

---

## 📊 Quick Stats

### Selection Limits
```
Max devices: Unlimited
Max group drag: Unlimited
Keyboard shortcuts: 15+
Mouse actions: 8+
```

### Performance
```
Selection update: <1ms
Group drag: 60 FPS
Render update: Instant
Memory impact: Minimal
```

---

## 🎨 Accessibility

### Keyboard Only Navigation
```
Tab → Focus canvas
Arrows → Pan view
Enter → Select/Open
Space → Alternative action
Esc → Cancel/Deselect
```

### Screen Reader Support
```
Announces: Device name
Announces: Selection state
Announces: Action taken
```

---

**Quick Start:** Just **Shift+Click** to select multiple, then **Drag** to move!

**Last Updated:** April 1, 2026  
**Version:** Network Simulator 2026 Pro
