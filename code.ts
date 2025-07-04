/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 350, height: 500 });

interface LooseColorGroup {
    hex: string;
    opacity: number;
    nodes: Array<{ id: string; name: string; type: string }>;
}

interface FullAnalysisResult {
    libraries: { [key: string]: { total: number, styles: any[] } };
    looseColors: LooseColorGroup[];
}

function rgbToHex(color: RGB): string {
    const toHex = (n: number) => {
        const hex = Math.round(n * 255).toString(16);
        return ('0' + hex).slice(-2);
    };
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();
}

function collectLinkedStyleIds(node: SceneNode): Set<string> {
    const styleIds = new Set<string>();
    const add = (id: string | typeof figma.mixed) => {
        if (typeof id === 'string' && id) {
            styleIds.add(id);
        }
    };

    // Check basic style properties
    if ('fillStyleId' in node) add(node.fillStyleId);
    if ('strokeStyleId' in node) add(node.strokeStyleId);
    if ('textStyleId' in node) add(node.textStyleId);
    if ('effectStyleId' in node) add(node.effectStyleId);
    if ('gridStyleId' in node) add(node.gridStyleId);

    // Handle text nodes with mixed styles
    if (node.type === 'TEXT') {
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

    // Handle mixed fills
    if ('fills' in node && node.fillStyleId === figma.mixed && Array.isArray(node.fills)) {
        for (const paint of node.fills) {
            if ('styleId' in paint && paint.styleId) add(paint.styleId);
        }
    }

    // Handle mixed strokes
    if ('strokes' in node && 'strokeStyleId' in node && (node as any).strokeStyleId === figma.mixed && Array.isArray(node.strokes)) {
        for (const stroke of node.strokes) {
            if ('styleId' in stroke && stroke.styleId) add(stroke.styleId);
        }
    }

    return styleIds;
}

// Removed findLooseColors - now done in main() for better performance



async function main(): Promise<void> {
    const styleUsageCounts: { [styleId: string]: number } = {};
    const colorMap = new Map<string, LooseColorGroup>();
    
    // Single traversal to collect both style IDs and loose colors - much more efficient!
    const nodesWithFills = figma.root.findAll(node => 
        'fills' in node || 'fillStyleId' in node || 'strokeStyleId' in node || 
        'textStyleId' in node || 'effectStyleId' in node
    );
    
    for (const node of nodesWithFills) {
        // Collect style IDs
        const nodeStyleIds = collectLinkedStyleIds(node as SceneNode);
        for (const id of nodeStyleIds) {
            styleUsageCounts[id] = (styleUsageCounts[id] || 0) + 1;
        }
        
        // Collect loose colors in the same pass
        if ('fills' in node && Array.isArray(node.fills)) {
            (node.fills as Paint[]).forEach(fill => {
                if (fill.type === 'SOLID' && !('styleId' in fill) && fill.visible) {
                    const hex = rgbToHex(fill.color);
                    const opacity = fill.opacity ?? 1;
                    const key = `${hex}_${opacity}`;

                    if (!colorMap.has(key)) {
                        colorMap.set(key, { hex, opacity, nodes: [] });
                    }

                    colorMap.get(key)!.nodes.push({
                        id: node.id,
                        name: node.name,
                        type: node.type
                    });
                }
            });
        }
    }

    const libraries = await categorizeStyles(styleUsageCounts);
    const looseColors = Array.from(colorMap.values());

    // Add loose colors as a library if any exist
    if (looseColors.length > 0) {
        const totalLooseColors = looseColors.reduce((sum, color) => sum + color.nodes.length, 0);
        libraries['🎨 Loose Colors'] = {
            total: totalLooseColors,
            styles: looseColors.map(color => ({
                id: `loose-${color.hex}`,
                name: color.hex, // Remove opacity % as requested
                count: color.nodes.length,
                type: 'LOOSE_COLOR',
                hex: color.hex,
                opacity: color.opacity
            }))
        };
    }

    figma.ui.postMessage({ 
        type: 'FULL_RESULT', 
        payload: { libraries } 
    });
}

async function categorizeStyles(styleUsageCounts: { [styleId: string]: number }) {
    const libraries: { [key: string]: { total: number, styles: any[] } } = {};
    const styleIds = Object.keys(styleUsageCounts);
    
    // Batch process styles for better performance
    const batchSize = 20; // Process in batches to avoid blocking UI
    
    for (let i = 0; i < styleIds.length; i += batchSize) {
        const batch = styleIds.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (styleId) => {
            try {
                const style = await figma.getStyleById(styleId);
                if (!style) return;

                const count = styleUsageCounts[styleId];
                let libraryName = 'Local Styles';
                
                if (style.remote) {
                    libraryName = style.name.split('/')[0].trim() || 'External Library';
                } else if (style.name.includes('/')) {
                    libraryName = `[Local] ${style.name.split('/')[0].trim()}`;
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
                // Silently ignore errors for styles that can't be accessed
            }
        }));
        
        // Small delay between batches to keep UI responsive
        if (i + batchSize < styleIds.length) {
            await new Promise(resolve => setTimeout(resolve, 1));
        }
    }

    return libraries;
}

function getParentPage(node: SceneNode): PageNode | null {
    let parent = node.parent;
    while (parent && parent.type !== 'PAGE') {
        parent = parent.parent;
    }
    return parent && parent.type === 'PAGE' ? parent : null;
}

function selectNodes(nodesToSelect: SceneNode[]): void {
    if (nodesToSelect.length === 0) {
        figma.notify('No layers found.');
        return;
    }

    // Filter nodes on current page
    const nodesOnCurrentPage = nodesToSelect.filter(n => 
        getParentPage(n)?.id === figma.currentPage.id
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
        // Switch to first node's page
        const pageOfFirstNode = getParentPage(nodesToSelect[0]);
        if (pageOfFirstNode) {
            figma.currentPage = pageOfFirstNode;
            
            const nodesOnNewPage = nodesToSelect.filter(n => 
                getParentPage(n)?.id === pageOfFirstNode.id
            );
            
            figma.currentPage.selection = nodesOnNewPage;
            figma.viewport.scrollAndZoomIntoView(nodesOnNewPage);
            figma.notify(`Switched page and selected ${nodesOnNewPage.length} layer(s).`);
        }
    }
}

// Don't auto-start - wait for user to click "Scan document"

// Message handler for UI interactions
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'SCAN_DOCUMENT') {
        // Start the scan when user clicks the button
        await main();
    } else if (msg.type === 'LOCATE_STYLE') {
        const { styleId } = msg.payload;
        const nodesToSelect = figma.root.findAll(n => 
            collectLinkedStyleIds(n as SceneNode).has(styleId)
        );
        selectNodes(nodesToSelect as SceneNode[]);
    } else if (msg.type === 'LOCATE_LOOSE_COLOR') {
        const { hex, opacity } = msg.payload;
        const nodesToSelect: SceneNode[] = [];
        
        const allNodes = figma.root.findAll(n => 'fills' in n);
        for (const node of allNodes) {
            if ('fills' in node && Array.isArray(node.fills)) {
                for (const paint of node.fills as Paint[]) {
                    if (paint.type === 'SOLID' && 
                        !('styleId' in paint) && 
                        paint.visible &&
                        rgbToHex(paint.color) === hex && 
                        (paint.opacity ?? 1) === opacity) {
                        nodesToSelect.push(node as SceneNode);
                        break;
                    }
                }
            }
        }
        selectNodes(nodesToSelect);
    }
};