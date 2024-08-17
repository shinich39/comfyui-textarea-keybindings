"use strict";

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { ComfyWidgets } from "../../../scripts/widgets.js";

let isSelectionEnabled = typeof window.getSelection !== "undefined";
let selectedElement = null;
let histories = [];

const ANNOTATION = ["\/*", "*\/"];

const BRACKETS = {
  "(": ["(",")"],
  "{": ["{","|}", (o, n) => n.range[0] !== n.range[1] ? [n.range[1]+1, n.range[1]+1] : n.range],
  "[": ["[","]"],
  "<": ["<",">"],
}

const REPLACEMENTS = {
  // "Tab": "  ",
}

const SHORTCUTS = {
  "Ctrl+z": undoHandler,
  "Tab": "next",
  "Ctrl+/": "annotation",
  // "Ctrl+ArrowUp": "incWeight", // /web/extensions/core/editAttentio.js/init/editAttension
  // "Ctrl+ArrowDown": "decWeight", // /web/extensions/core/editAttentio.js/init/editAttension
}

function getSelectionRange(el) {
  return [
    el.selectionStart,
    el.selectionEnd,
  ];
}

function isSelected(el) {
  return selectedElement && selectedElement.isSameNode(el);
}

function getPrevValue() {
  if (histories.length > 0) {
    return histories[histories.length - 1].newText;
  }
}

function getPrevRange() {
  if (histories.length > 0) {
    return histories[histories.length - 1].newRange;
  }
}

function getHistory(el) {
  if (!selectedElement || !el.isSameNode(selectedElement)) {
    return;
  }
  if (getPrevValue() === el.value) {
    return histories.pop();
  }
}

function getCombinationKey({ key, ctrlKey, metaKey, shiftKey }) {
  return (ctrlKey || metaKey ? "Ctrl+" : "") + (shiftKey ? "Shift+" : "") + key;
}

function isBracket(e) {
  return Object.keys(BRACKETS).indexOf(e.key) > -1;
}

function isReplacement(e) {
  const key = getCombinationKey(e);
  return Object.keys(REPLACEMENTS).indexOf(key) > -1;
}

function isShortcut(e) {
  const key = getCombinationKey(e);
  return Object.keys(SHORTCUTS).indexOf(key) > -1;
}

function chkElement(e) {
  if (!isSelected(e.target)) {
    selectedElement = e.target;
    histories = [];
  }
}

function bracketHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  const { key } = e;
  const shiftKey = e.shiftKey;
  const ctrlKey = e.ctrlKey || e.metaKey;
  let brackets = BRACKETS[key];
  let oldRange = getSelectionRange(e.target);
  let oldText = e.target.value;
  let oldPart = oldText.substring(oldRange[0], oldRange[1]);
  let newPart = `${brackets[0]}${oldPart}${brackets[1]}`;
  let newText = oldText.substring(0, oldRange[0]) + 
                newPart +
                oldText.substring(oldRange[1]);

  let newRange = [
    oldRange[0] + brackets[0].length,
    oldRange[1] + brackets[0].length
  ];

  if (typeof brackets[2] === "function") {
    newRange = brackets[2](
      {text: oldText, range: oldRange}, 
      {text: newText, range: newRange},
    );
  }

  e.target.value = newText;
  e.target.focus();
  e.target.setSelectionRange(newRange[0], newRange[1]);

  chkElement(e);

  const prevText = getPrevValue();
  if (prevText && prevText !== oldText) {
    histories.push({
      oldText: prevText,
      newText: oldText,
      oldRange: getPrevRange(),
      newRange: oldRange,
    });
  }

  histories.push({
    oldText: oldText,
    newText: newText,
    oldRange: oldRange,
    newRange: newRange,
  });
}

function replaceHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  const { key } = e;
  const shiftKey = e.shiftKey;
  const ctrlKey = e.ctrlKey || e.metaKey;
  let replacement = REPLACEMENTS[key];
  let oldRange = getSelectionRange(e.target);
  let oldText = e.target.value;
  let newText = oldText.substring(0, oldRange[0]) + 
                replacement +
                oldText.substring(oldRange[1]);

  let newRange = [
    oldRange[0] + replacement.length,
    oldRange[0] + replacement.length
  ];

  e.target.value = newText;
  e.target.focus();
  e.target.setSelectionRange(newRange[0], newRange[1]);

  chkElement(e);

  histories.push({
    oldText: oldText,
    newText: newText,
    oldRange: oldRange,
    newRange: newRange,
  });
}

function shortcutHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  let shortcut = SHORTCUTS[getCombinationKey(e)];
  if (typeof shortcut === "function") {
    shortcut(e);
    return;
  }

  let addHistory = false;

  let oldRange = getSelectionRange(e.target);
  let oldText = e.target.value;

  let newRange = [oldRange[0],oldRange[1]];
  let newText = oldText;

  let prevLeft = oldText.substring(0, oldRange[0]);
  let prevCenter = oldText.substring(oldRange[0], oldRange[1]);
  let prevRight = oldText.substring(oldRange[1]);
  
  let currLeft = prevLeft;
  let currCenter = prevCenter;
  let currRight = prevRight;

  // let start = [currLeft.lastIndexOf("\n"), currLeft.lastIndexOf(",")].sort((a, b) => a - b).pop();
  let start = currLeft.lastIndexOf(",");
  if (start > -1) {
    currCenter = currLeft.substring(start + 1) + currCenter;
    currLeft = currLeft.substring(0, start + 1);
  } else {
    currCenter = currLeft + currCenter;
    currLeft = "";
  }
  
  // let end = [currRight.indexOf("\n"), currRight.indexOf(",")].sort((a, b) => b - a).pop();
  let end = currRight.indexOf(",");
  if (end > -1) {
    currCenter = currCenter + currRight.substring(0, end);
    currRight = currRight.substring(end);
  } else {
    currCenter = currCenter + currRight;
    currRight = "";
  }

  if (shortcut === "annotation") {
    // check exists annotation
    let lla = currLeft.lastIndexOf(ANNOTATION[0]);
    let lra = currLeft.lastIndexOf(ANNOTATION[1]);
    let cla = currCenter.indexOf(ANNOTATION[0]);
    let cra = currCenter.indexOf(ANNOTATION[1]);
    let rla = currRight.indexOf(ANNOTATION[0]);
    let rra = currRight.indexOf(ANNOTATION[1]);
    let clc = oldRange[0] - currLeft.length;
    let crc = oldRange[1] - currLeft.length;

    // check left annotation
    if (lla > lra || (lla !== -1 && lra === -1)) {
      if (cra > -1) {
        currCenter = currCenter.substring(0, cra) + currCenter.substring(cra + 2);
        newRange[0] += Math.max(-2, Math.min(0, cra - clc));
        newRange[1] += Math.max(-2, Math.min(0, cra - crc));
      } else if (rra > -1) {
        currRight = currRight.substring(0, rra) + currRight.substring(rra + 2);
      }
      currLeft = currLeft.substring(0, lla) + currLeft.substring(lla + 2);
      newRange[0] -= 2;
      newRange[1] -= 2;
    } else if (rla > rra || (rla === -1 && rra !== -1)) {
      // check right annotation
      if (cla > -1) {
        currCenter = currCenter.substring(0, cla) + currCenter.substring(cla + 2);
        newRange[0] += Math.max(-2, Math.min(0, cla - clc));
        newRange[1] += Math.max(-2, Math.min(0, cla - crc));
      } else if (lla > -1) {
        currLeft = currLeft.substring(0, lla) + currLeft.substring(lla + 2);
        newRange[0] -= 2;
        newRange[1] -= 2;
      }
      currRight = currRight.substring(0, rra) + currRight.substring(rra + 2);
    } else {
      currCenter = currCenter.replace(/\/\*|\*\//g, ""); // remove annotation
      if (cla > -1 && cra > -1) {
        newRange[0] += Math.max(-2, Math.min(0, cla - clc));
        newRange[1] += Math.max(-2, Math.min(0, cla - crc));
        newRange[0] += Math.max(-2, Math.min(0, cra - clc));
        newRange[1] += Math.max(-2, Math.min(0, cra - crc));
      } else {
        newRange[0] += 2;
        newRange[1] += 2;
        currCenter = `/*${currCenter}*/`;
      }
    }

    newText = currLeft+currCenter+currRight;
    addHistory = true;
  } else if (shortcut === "next") {
    if (prevCenter.trim() === currCenter.trim()) {
      let rfc = currRight.indexOf(",");
      let rsc = rfc > -1 ? currRight.indexOf(",", rfc + 1) : -1;
      if (rfc > -1 && rsc > -1) {
        currLeft = currLeft + currCenter + currRight.substring(0, rfc + 1);
        currCenter = currRight.substring(rfc + 1, rsc);
        currRight = currRight.substring(rsc);
      } else if (rfc > -1 && rsc === -1 && currRight.substring(rfc + 1).trim() != "") {
        currLeft = currLeft + currCenter + currRight.substring(0, rfc + 1);
        currCenter = currRight.substring(rfc + 1);
        currRight = "";
      } else {
        let tfc = oldText.indexOf(",");
        if (tfc > -1) {
          currLeft = "";
          currCenter = oldText.substring(0, tfc);
          currRight = oldText.substring(tfc);
        }
      }
    }

    let center = currCenter.trim();
    let offset = currCenter.indexOf(center);
    newRange[0] = currLeft.length + offset;
    newRange[1] = currLeft.length + offset + center.length;
  }

  e.target.value = newText;
  e.target.focus();
  e.target.setSelectionRange(newRange[0], newRange[1]);

  if (addHistory) {
    chkElement(e);

    histories.push({
      oldText: oldText,
      newText: newText,
      oldRange: oldRange,
      newRange: newRange,
    });
  }
} 

function undoHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  const { key } = e;
  const shiftKey = e.shiftKey;
  const ctrlKey = e.ctrlKey || e.metaKey;
  const history = getHistory(e.target);
  if (history) {
    const { oldText, oldRange } = history;
    e.target.value = oldText;
    e.target.focus();
    e.target.setSelectionRange(oldRange[0], oldRange[1]);
  }
}

app.registerExtension({
	name: "shinich39.TextareaKeybindings",
	init() {
    if (!isSelectionEnabled) {
      console.error(new Error("comfyui-textarea-keybindings is disabled."));
      return;
    }

    // textarea
    const STRING = ComfyWidgets.STRING;
    ComfyWidgets.STRING = function (node, inputName, inputData) {
      const r = STRING.apply(this, arguments);
      if (!inputData[1]?.multiline) {
        return r;
      }
      if (!r.widget?.element) {
        return r;
      }
    
      const widget = r.widget;
      const element = widget.element;

      // keybindings
      element.addEventListener("keydown", async function(e) {
        try {
          // const { key } = e;
          // const shiftKey = e.shiftKey;
          // const ctrlKey = e.ctrlKey || e.metaKey;

          if (isBracket(e)) {
            bracketHandler(e);
          } else if (isReplacement(e)) {
            replaceHandler(e);
          } else if (isShortcut(e)) {
            shortcutHandler(e);
          }
        } catch(err) {
          console.error(err);
        }
      }, true);

      return r;
    };
	},
  nodeCreated(node) {
		if (node.widgets) {
			// Locate dynamic prompt text widgets
			// Include any widgets with dynamicPrompts set to true, and customtext
			const widgets = node.widgets.filter(
				(n) => n.dynamicPrompts
			);
			for (const widget of widgets) {
				// Override the serialization of the value to resolve dynamic prompts for all widgets supporting it in this node
        const origSerializeValue = widget.serializeValue;
        widget.serializeValue = function(workflowNode, widgetIndex) {
          let r = origSerializeValue?.apply(this, arguments);

          // remove annotations
          let re = /\/\*(.(?!\/\*))+\*\/|\/\*\*\//g;
          r = r.replace(re, "");

          return r;
        }
			}
		}
	},
});