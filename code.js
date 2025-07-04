"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // code.ts
  var require_code = __commonJS({
    "code.ts"(exports) {
      figma.showUI(__html__, { width: 350, height: 500 });
      function rgbToHex(color) {
        const toHex = (n) => {
          const hex = Math.round(n * 255).toString(16);
          return ("0" + hex).slice(-2);
        };
        return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();
      }
      function collectLinkedStyleIds(node) {
        const styleIds = /* @__PURE__ */ new Set();
        const add = (id) => {
          if (typeof id === "string" && id) {
            styleIds.add(id);
          }
        };
        if ("fillStyleId" in node)
          add(node.fillStyleId);
        if ("strokeStyleId" in node)
          add(node.strokeStyleId);
        if ("textStyleId" in node)
          add(node.textStyleId);
        if ("effectStyleId" in node)
          add(node.effectStyleId);
        if ("gridStyleId" in node)
          add(node.gridStyleId);
        if (node.type === "TEXT") {
          if (node.textStyleId === figma.mixed) {
            for (let i = 0; i < node.characters.length; i++) {
              add(node.getRangeTextStyleId(i, i + 1));
            }
          }
          if (node.fillStyleId === figma.mixed) {
            for (let i = 0; i < node.characters.length; i++) {
              add(node.getRangeFillStyleId(i, i + 1));
            }
          }
        }
        if ("fills" in node && node.fillStyleId === figma.mixed && Array.isArray(node.fills)) {
          for (const paint of node.fills) {
            if ("styleId" in paint && paint.styleId)
              add(paint.styleId);
          }
        }
        if ("strokes" in node && "strokeStyleId" in node && node.strokeStyleId === figma.mixed && Array.isArray(node.strokes)) {
          for (const stroke of node.strokes) {
            if ("styleId" in stroke && stroke.styleId)
              add(stroke.styleId);
          }
        }
        return styleIds;
      }
      function main() {
        return __async(this, null, function* () {
          const styleUsageCounts = {};
          const colorMap = /* @__PURE__ */ new Map();
          const nodesWithFills = figma.root.findAll(
            (node) => "fills" in node || "fillStyleId" in node || "strokeStyleId" in node || "textStyleId" in node || "effectStyleId" in node
          );
          for (const node of nodesWithFills) {
            const nodeStyleIds = collectLinkedStyleIds(node);
            for (const id of nodeStyleIds) {
              styleUsageCounts[id] = (styleUsageCounts[id] || 0) + 1;
            }
            if ("fills" in node && Array.isArray(node.fills)) {
              node.fills.forEach((fill) => {
                var _a;
                if (fill.type === "SOLID" && !("styleId" in fill) && fill.visible) {
                  const hex = rgbToHex(fill.color);
                  const opacity = (_a = fill.opacity) != null ? _a : 1;
                  const key = `${hex}_${opacity}`;
                  if (!colorMap.has(key)) {
                    colorMap.set(key, { hex, opacity, nodes: [] });
                  }
                  colorMap.get(key).nodes.push({
                    id: node.id,
                    name: node.name,
                    type: node.type
                  });
                }
              });
            }
          }
          const libraries = yield categorizeStyles(styleUsageCounts);
          const looseColors = Array.from(colorMap.values());
          if (looseColors.length > 0) {
            const totalLooseColors = looseColors.reduce((sum, color) => sum + color.nodes.length, 0);
            libraries["\u{1F3A8} Loose Colors"] = {
              total: totalLooseColors,
              styles: looseColors.map((color) => ({
                id: `loose-${color.hex}`,
                name: color.hex,
                count: color.nodes.length,
                type: "LOOSE_COLOR",
                hex: color.hex,
                opacity: color.opacity
              }))
            };
          }
          figma.ui.postMessage({
            type: "FULL_RESULT",
            payload: { libraries }
          });
        });
      }
      function categorizeStyles(styleUsageCounts) {
        return __async(this, null, function* () {
          const libraries = {};
          const styleIds = Object.keys(styleUsageCounts);
          const batchSize = 20;
          for (let i = 0; i < styleIds.length; i += batchSize) {
            const batch = styleIds.slice(i, i + batchSize);
            yield Promise.all(batch.map((styleId) => __async(this, null, function* () {
              try {
                const style = yield figma.getStyleById(styleId);
                if (!style)
                  return;
                const count = styleUsageCounts[styleId];
                let libraryName = "Local Styles";
                if (style.remote) {
                  libraryName = style.name.split("/")[0].trim() || "External Library";
                } else if (style.name.includes("/")) {
                  libraryName = `[Local] ${style.name.split("/")[0].trim()}`;
                }
                if (!libraries[libraryName]) {
                  libraries[libraryName] = { total: 0, styles: [] };
                }
                libraries[libraryName].styles.push({
                  id: style.id,
                  name: style.name,
                  count,
                  type: style.type
                });
                libraries[libraryName].total += count;
              } catch (error) {
              }
            })));
            if (i + batchSize < styleIds.length) {
              yield new Promise((resolve) => setTimeout(resolve, 1));
            }
          }
          return libraries;
        });
      }
      function getParentPage(node) {
        let parent = node.parent;
        while (parent && parent.type !== "PAGE") {
          parent = parent.parent;
        }
        return parent && parent.type === "PAGE" ? parent : null;
      }
      function selectNodes(nodesToSelect) {
        if (nodesToSelect.length === 0) {
          figma.notify("No layers found.");
          return;
        }
        const nodesOnCurrentPage = nodesToSelect.filter(
          (n) => {
            var _a;
            return ((_a = getParentPage(n)) == null ? void 0 : _a.id) === figma.currentPage.id;
          }
        );
        if (nodesOnCurrentPage.length > 0) {
          figma.currentPage.selection = nodesOnCurrentPage;
          figma.viewport.scrollAndZoomIntoView(nodesOnCurrentPage);
          let message = `Selected ${nodesOnCurrentPage.length} layer(s) on this page.`;
          if (nodesToSelect.length > nodesOnCurrentPage.length) {
            message += ` Found ${nodesToSelect.length - nodesOnCurrentPage.length} more on other page(s).`;
          }
          figma.notify(message);
        } else {
          const pageOfFirstNode = getParentPage(nodesToSelect[0]);
          if (pageOfFirstNode) {
            figma.currentPage = pageOfFirstNode;
            const nodesOnNewPage = nodesToSelect.filter(
              (n) => {
                var _a;
                return ((_a = getParentPage(n)) == null ? void 0 : _a.id) === pageOfFirstNode.id;
              }
            );
            figma.currentPage.selection = nodesOnNewPage;
            figma.viewport.scrollAndZoomIntoView(nodesOnNewPage);
            figma.notify(`Switched page and selected ${nodesOnNewPage.length} layer(s).`);
          }
        }
      }
      figma.ui.onmessage = (msg) => __async(exports, null, function* () {
        var _a;
        if (msg.type === "SCAN_DOCUMENT") {
          yield main();
        } else if (msg.type === "LOCATE_STYLE") {
          const { styleId } = msg.payload;
          const nodesToSelect = figma.root.findAll(
            (n) => collectLinkedStyleIds(n).has(styleId)
          );
          selectNodes(nodesToSelect);
        } else if (msg.type === "LOCATE_LOOSE_COLOR") {
          const { hex, opacity } = msg.payload;
          const nodesToSelect = [];
          const allNodes = figma.root.findAll((n) => "fills" in n);
          for (const node of allNodes) {
            if ("fills" in node && Array.isArray(node.fills)) {
              for (const paint of node.fills) {
                if (paint.type === "SOLID" && !("styleId" in paint) && paint.visible && rgbToHex(paint.color) === hex && ((_a = paint.opacity) != null ? _a : 1) === opacity) {
                  nodesToSelect.push(node);
                  break;
                }
              }
            }
          }
          selectNodes(nodesToSelect);
        }
      });
    }
  });
  require_code();
})();
