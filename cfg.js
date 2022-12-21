/*
/* Cfg viewer V0.2
*/

d3.json('data/nodes.json', d => {
    spaceTree(d);
});

/* Constant Value */
const DOI_TYPE = {
    MOST_CARE: 1 << 0,
    MEDIEAN_CARE: 1 << 1,
    LITTLE_CARE: 1 << 2,
    DONT_CARE: 1 << 3
}

const TEXT_PADDING = {
    HEAD_TOP: 15,
    HEAD_HEIGHT: 20,
    CONTENT_LEFT: 10,
    CONTENT_HEIGHT: 15,
    TEXT_WIDTH: 6.5
}

const NODE_COLOR = {
    NORMAL: "#fff",
    FOLD: `hsl(100, 100%, 90%)`,
    MERGE: `hsl(200, 100%, 90%)`,
    FOLD_AND_MERGE: `hsl(360, 100%, 90%)`
}

/* Nodes and Links Function*/
function mergeNodes(nodes, merge_ids) {
    // 检查merge_nodes必须是具有线性关系的节点
    merge_ids = merge_ids.map(Number);
    if (merge_ids.length < 2) return;
    for (let i = 0; i < merge_ids.length - 1; i += 1) {
        if (!getDescendants(nodes, nodes[merge_ids[i]]).includes(merge_ids[i + 1])) {
            console.log("Invalid Merge:", merge_ids);
            return;
        }
    }
    // 合并节点（假设节点已按先后顺序排列好）
    let topNode = nodes[merge_ids[0]];
    for (let i = 1; i < merge_ids.length; i += 1) {
        let node = nodes[merge_ids[i]];

        topNode.container.push(merge_ids[i]);
        node.owner = merge_ids[0];
    }
    return nodes;
}

function untieNodes(nodes, id) {
    // 将主节点展开
    let node = nodes[id];
    if (node.container.length == 0) return;
    node.container.forEach(sub_id => {
        let sub_node = nodes[sub_id]
        sub_node.owner = null;
    })
    node.container = [];
}

function getNodesAndLinks(nodes) {
    // 利用DFS生成需要绘制的节点和边，忽略折叠的、合并的节点及边
    let visited = new Set();
    let links = new Set();
    let dnodes = [];
    function getLinksFromNode(node) {
        if (visited.has(node.id)) return;
        visited.add(node.id);
        // Add Node
        if (node.owner == null)
            dnodes.push(node);
        // Add Path
        let src_id = getOwner(node.id);
        if (!node.is_fold) {
            node.children.forEach(child => {
                let tgt_id = getOwner(child);
                if (src_id != tgt_id) {
                    links.add({
                        source: src_id,
                        target: tgt_id
                    });
                }
                getLinksFromNode(nodes[child]);
            })
        }
    }
    getLinksFromNode(nodes[0]);
    return [dnodes, Array.from(links)];

    function getOwner(id) {
        let owner = id;
        while (nodes[owner].owner != null) owner = nodes[owner].owner;
        return owner;
    }
}

function getDescendants(nodes, node) {
    // 获取从node出发可以抵达的所有节点
    let visited = new Set();
    let descendants = [];
    function addChildren(node) {
        if (visited.has(node.id)) return;
        visited.add(node.id);
        node.children.forEach(child => {
            descendants.push(child);
            addChildren(nodes[child]);
        })
    }
    addChildren(node);
    return descendants.map(Number);
}

function getNodeSize(node) {
    function getAsmLength(asm) {
        return (asm.addr + asm.mnemonic + asm.operands).length;
    }
    function getLongestAsmLength(node) {
        if(getAsmCount(node) == 0)  // only puts
            return getTitleLength(node);

        function getLongerAsm(asma, asmb) {
            return getAsmLength(asma) > getAsmLength(asmb) ? asma : asmb;
        }
        return getAsmLength(node.content.asm.reduce(getLongerAsm, {addr: "", mnemonic: "", operands: ""}));
    }
    function getAsmCount(node) {
        return node.content.asm.length;
    }
    function getTitleLength(node) {
        return (node.content.head.addr + node.content.head.func_addr + node.content.head.name).length;
    }
    
    
    let width = getTitleLength(node) * TEXT_PADDING.TEXT_WIDTH;
    let height = TEXT_PADDING.HEAD_TOP + TEXT_PADDING.HEAD_HEIGHT;

    if (node.doi_type == DOI_TYPE.MOST_CARE)
        height += + getAsmCount(node) * TEXT_PADDING.CONTENT_HEIGHT;
        width = Math.max(width, getLongestAsmLength(node) * TEXT_PADDING.TEXT_WIDTH);

    // if(node.doi_type == DOI_TYPE.MOST_CARE)
    //     result = [getLongestAsmLength(node) * TEXT_PADDING.TEXT_WIDTH, TEXT_PADDING.HEAD_HEIGHT + getAsmCount(node) * TEXT_PADDING.CONTENT_HEIGHT];  // full description
    // else if(node.doi_type == DOI_TYPE.MEDIEAN_CARE)
    //     result = [getLongestAsmLength(node) * xscale, (getAsmCount(node) <= 1 ? 1 : 2) * yscale]; // display first and last asm / single put/jmp
    // else
    //     result = [getTitleLength(node) * xscale, 1 * yscale];   // only titke is shown

    return [width, height];
}

/* Outdated Function */
function getLinkFromRoot(root, nodes) {
    // linK: {source: node, target: node}
    // only consider link in nodes
    // console.log(root);
    let validNode = new Set();
    nodes.forEach(n => validNode.add(n.data.id));

    let visited = new Set();
    let links = [];
    getLink(root);
    function getLink(node) {
        if(!visited.has(node.data.id)) {
            visited.add(node.data.id);
            // add edge
            for(let i = 0; i < node.data.edge.length; ++i) {
                // IMPORTANT: we only consider edge from node of interest and in nodes
                let target = nodeMap[node.data.edge[i]];
                if(target.doi_type != DOI_TYPE.LITTLE_CARE && validNode.has(target.data.id))
                    links.push({
                        source: node,
                        target
                    });
            }
            // add child link
            if(node.children) {
                node.children.forEach(child => {
                    if(child.doi_type != DOI_TYPE.LITTLE_CARE) {
                        // console.log("child link:", {
                        //     source: node,
                        //     target: child
                        // });
                        links.push({
                            source: node,
                            target: child
                        });
                        getLink(child);
                    }
                });
            }
        }
    }
    console.log("Link")
    console.log(links)
    return links;
}

function getNodesFromRoot(root) {
    // linK: {source: node, target: node}
    let visited = new Set();
    let nodes = [];
    getNode(root);
    function getNode(node) {
        if(!visited.has(node.data.id)) {
            visited.add(node.data.id);
            if(node.doi_type != DOI_TYPE.LITTLE_CARE)
                nodes.push(node);
            if(node.children) {
                node.children.forEach(child => getNode(child));
            }
        }
    }
    return nodes;
}

/* Main */
function spaceTree(nodes, {
    width = 2048, // outer width, in pixels
    height = 4096, // outer height, in pixels
    margin = 100, // shorthand for margins
    marginTop = margin, // top margin, in pixels
    marginLeft = margin, // left margin, in pixels
    padding = 100, // padding around the labels
    duration = 350,
} = {})
{
    let diagonal = d3.svg.diagonal();

    /* Compute DOI(temp) */
    nodes.forEach(node => {
        node.doi_type = DOI_TYPE.MOST_CARE;
    })
    // computeDOI(root);

    /* Data Supplement */
    nodes.forEach(node => {
        node.content.head.name = node.content.head.name ? node.content.head.name : "jmp";
        node.content.asm = node.content.asm ? node.content.asm : [];
        node.id = "" + node.id;
        node.size = getNodeSize(node);
        node.owner = null;
        node.container = [];
        node.is_fold = false;
    })

    // compute minSize of all nodes
    // const minSize = xy => node => node.nodes.reduce(
    // (min, node) => Math.min(min, getNodeSize(node)[xy]), Infinity);
    // const minXSize = minSize(0);
    // const minYSize = minSize(1);
    // console.log(minXSize);
    // console.log(minYSize);
    // tree(root);
    // const extents = root.extents;

    // const scale = Math.min(width / (extents.right - extents.left),
    // height / extents.bottom);

    // Center the tree.
    let svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("class", "board")
        // .attr('transform', `translate(${padding + transX} ${padding}) scale(${scale} ${scale})`);
    
    /* Marker */
    // Arrow
    let marker = svg.append("defs").append("marker")
        .attr("id", "arrow")
        .attr("markerUnits", "strokeWidth")
        .attr("markerWidth", 5)
        .attr("markerHeight", 4)
        .attr("refX", 5)
        .attr("refY", 2)
        .attr("orient", "auto");

    marker.append("path")
        .attr("d", "M 0 0 L 5 2 L 0 4 z")
        .attr("fill", "#707070");

    /* Brush */
    var xScale = d3.scale.linear().domain([0, width]).range([0, width]);
    var yScale = d3.scale.linear().domain([0, height]).range([0, height]);
    var brush = d3.svg.brush()
        .x(xScale)
        .y(yScale)
        .extent([[0, 0], [0, 0]])
        .on("brushstart", brushStart)
        .on("brush", brushMove)
        .on("brushend", brushEnd);

    var brushg = svg.append("g")
        .attr("class", "brush")
        .call(brush);

    /* Test */
    update(nodes);
    
    
    /* 
    /*   ==== function definitions ==== 
    */
    // precondition: every node have an id
    function computeDOI(source)
    {
        let visited = new Set();
        
        function DOIHelper(node, distance)
        {
            if(visited.has(node.id))
                return;

            visited.add(node.id);
            node.doi = -node.depth - distance;
            if(node.doi == source.doi)
                node.doi_type = DOI_TYPE.MOST_CARE;
            else if(node.doi == source.doi - 2)
                node.doi_type = DOI_TYPE.MEDIEAN_CARE;
            else
                node.doi_type = DOI_TYPE.LITTLE_CARE;
            
            if(node.children)
            {
                node.children.forEach(n => {
                    DOIHelper(n, distance + 1);
                });
            } else if(node._children) {
                // compute all children
                node._children.forEach(n => {
                    DOIHelper(n, distance + 1);
                });
            }

            if(node.parent)
                DOIHelper(node.parent, distance + 1);
            
        }

        DOIHelper(source, 0);
    }

    function update(nodes) {
        let [dnodes, links] = getNodesAndLinks(nodes);

        /* Dagre Layout */
        const g = new dagre.graphlib.Graph()
            .setGraph({ rankdir: "TB", marginx: 50, marginy: 50, ranksep: 55 })
            .setDefaultEdgeLabel(() => ({}));

        dnodes.forEach(node => {
            g.setNode(node.id, { width: node.size[0], height: node.size[1]});
        });

        links.forEach(link => {
            g.setEdge(link.source, link.target);
        });

        dagre.layout(g);

        dagreNodes = g.nodes().map(id => {
            const node = nodes[id];
            const dnode = g.node(id);
            node.x = dnode.x;
            node.y = dnode.y;
            return node;
        });
        
        /* View Box(Auto Layout for svy) */
        let viewX = Infinity;  // 所有节点最左侧的X坐标
        let viewY = Infinity;  // 所有节点最顶部的Y坐标
        let viewW = 0;  // 给定最左侧X坐标时，所有节点最右侧坐标到X的距离
        let viewH = 0;  // 同理

        dagreNodes.forEach(n => {
            viewX = Math.min(viewX, n.x - n.size[0] / 2);
            viewY = Math.min(viewY, n.y - n.size[1] / 2);
        })
        dagreNodes.forEach(n => {
            viewW = Math.max(viewW, n.x + n.size[0] / 2);
            viewH = Math.max(viewH, n.y + n.size[1] / 2);
        })
        // console.log(viewX, viewY, viewW, viewH);
        // svg.attr("width", viewW);
        // svg.attr("height", viewH);
        // svg.attr("viewBox", [viewX, viewY, viewW, viewH]);
        // svg.attr("viewBox", [dagreNodes[0].x - width / 2, dagreNodes[0].y - 50, width, height]);
        // TODO: Wait Implementation

        /*
        /* ===== Node Processing =====
        */
        const roundScale = 5;
        let gnode = svg.selectAll("g.node")
            .data(dagreNodes, d => d.id);
        
        // Entering
        let nodeEnter = gnode.enter().append("g")
            .attr("class", "node")
            .on("click", click)
            .on("dblclick", dblclick);

        nodeEnter.append("g").append("rect")
            .attr("rx", roundScale)
            .attr("ry", roundScale)
            .attr("width", 0)
            .attr("height", 0)
            .attr("x", n => n.x)
            .attr("y", n => n.y)
            .style("fill", d => d.is_fold ? "lightsteelblue" : "#fff");

        nodeEnter.select("g").append("line")
            .attr("x1", n => n.x)
            .attr("y1", n => n.y)
            .attr("x2", n => n.x)
            .attr("y2", n => n.y)

        // Text
        nodeEnter.append("text")
            .attr("text-anchor", "middle")
            .attr("class", "head")
            .style("fill-opacity", 0);

        nodeEnter.append("g")
            .attr("class", "content")
            .selectAll("text")
            .data(d => {
                let data = [];
                let index = 1;
                d.content.asm.forEach(asm => {
                    data.push({
                        id: d.id,
                        line: index,
                        content: asm.addr + asm.mnemonic + asm.operands
                    });
                    index += 1;
                });
                return data;
            })
            .enter()
            .append("text")
        
        // use title to display doi
        // nodeEnter.append("title")
        //     .text(d => "DOI: " + d.doi)

        // Updating: from origin pos to new pos
        // note: 3 levels of visualizing according to node's doi
        let nodeUpdate = gnode.transition()
            .duration(duration);
        
        nodeUpdate.select("g").select("rect")
            .attr("class", "inner-box")
            .attr("x", n => n.x - n.size[0] / 2)
            .attr("y", n => n.y - n.size[1] / 2)
            .attr("width", n => n.size[0])
            .attr("height", n => n.size[1])
            .style("fill", d => {
                if (!d.is_fold && d.container.length == 0) {
                    return NODE_COLOR.NORMAL;
                } else if (d.is_fold && d.container.length == 0) {
                    return NODE_COLOR.FOLD;
                } else if (!d.is_fold && d.container.length != 0) {
                    return NODE_COLOR.MERGE;
                } else {
                    return NODE_COLOR.FOLD_AND_MERGE;
                }
            });

        nodeUpdate.select("g").select("line")
            .attr("x1", n => n.x - n.size[0] / 2)
            .attr("y1", n => {
                let startY = n.y - n.size[1] / 2;
                return startY + TEXT_PADDING.HEAD_HEIGHT;
            })
            .attr("x2", n => {
                return n.x + n.size[0] / 2;
            })
            .attr("y2", n => {
                let startY = n.y - n.size[1] / 2;
                return startY + TEXT_PADDING.HEAD_HEIGHT;
            })

        // note: for the biggest node, we need to slightly add x for better visualization
        nodeUpdate.select(".head")
            .text(d => {
                return d.content.head.addr + " " + d.content.head.func_addr + " " + d.content.head.name;
            })
            .style("fill-opacity", d => d.doi_type != DOI_TYPE.LITTLE_CARE ? 1 : 0)
            .attr("x", d => d.x)
            .attr("y", d => {
                return d.y - d.size[1] / 2 + TEXT_PADDING.HEAD_TOP; // TODO: 按照字体大小调整BIAS
            })
            // .attr("transform", d => `translate(${d.y},${d.x})`)
            // .attr("dy", "0.32em")
            // .attr("x", d => {
            //     if(d.doi == source.doi)
            //         return (d => d.children) ? -13 : 13;
            //     else 
            //         return (d => d.children) ? -10 : 10;
            // })
            // .attr("text-anchor", d => d.children ? "end" : "start");
            // Better presentation yet with low efficiency -- draw much lags
            // .attr("paint-order", "stroke")
            // .attr("stroke", halo)
            // .attr("stroke-width", haloWidth);
        
        nodeUpdate.select(".content")
            .selectAll("text")
            .attr("x", d => {
                let n = nodes[d.id];
                let startX = n.x - n.size[0] / 2;
                return startX + TEXT_PADDING.CONTENT_LEFT;
            })
            .attr("y", d => {
                let n = nodes[d.id];
                let startY = n.y - n.size[1] / 2;
                return startY + TEXT_PADDING.HEAD_HEIGHT + d.line * TEXT_PADDING.CONTENT_HEIGHT;
            })
            .text(d => d.content);
            // .style("fill-opacity", d => d.doi_type != DOI_TYPE.LITTLE_CARE ? 1 : 0)

        // nodeUpdate.select("title")
        //     .text(d => "DOI: " + d.doi)
            
        // Exiting
        let nodeExit = gnode.exit().transition()
            .duration(duration)
            .remove();

        nodeExit.selectAll("rect")
            .attr("width", 0)
            .attr("height", 0);

        nodeExit.selectAll("line")
            .attr("x1", n => n.x)
            .attr("y1", n => n.y)
            .attr("x2", n => n.x)
            .attr("y2", n => n.y);

        nodeExit.selectAll("text")
            .style("fill-opacity", 0);

        /*
        /* ===== Link Processing =====
        */

        // Entering
        const edges = g.edges()
            .map(d => {
                const dedge = g.edge(d);
                const edge = links.find(e => e.source == d.v && e.target == d.w);
                dedge.source = edge.source;
                dedge.target = edge.target;
                return dedge;
            })

        let link = svg
            .selectAll("path.link")
            .data(edges, d => d.source + "," +  d.target);

        // link.append('marker')
        // .attr('id', 'arrow')
        // .attr('viewBox', '0 -10 15 15')
        // .attr('refX', 15)
        // .attr('refY', 0)
        // .attr('markerWidth', 15)
        // .attr('markerHeight', 15)
        // .attr('markerUnits', 'userSpaceOnUse') // disable the effect of stroke width on the arrow
        // .attr('orient', 'auto');
            // Add new links at source's old pos
        link.enter().insert("path", "g")
            .attr("class", "link");

            // .attr('marker-end', 'url(#arrow)')
            // .attr("d", d => {
            //     let o = {x: d.source.x0 ? d.source.x0 : 0, y: d.source.y0  ? d.source.y0 + d.source.size[1] : 0};
            //     return diagonal({source: o, target: o});
            // });
        
        // Set links to their new pos.
        let line = d3.svg.line()
                    .x(d => d.x)
                    .y(d => d.y)
                    .interpolate("basis");

        link.transition()
            .duration(duration)
            .delay(duration * 0.5)
            .attr("d", d => {
                // console.log(d);
                // let s = {x: d.source.x, y: d.source.y + d.source.size[1]};
                
                // console.log("s + t:", s, t);
                // if(isParent(d.source, d.target)) {
                //     let s = {x: d.source.x, y: d.source.y + d.source.size[1] / 2};
                //     let t = {x: d.target.x, y: d.target.y};
                //     return diagonal({source: s, target: t});
                // }
                // else { 
                    // let data = {
                    //     x: d.points.map(p => p.x),
                    //     y: d.points.map(p => p.y)
                    // };
                    // console.log("lineData:", data);
                    // console.log("line:", line);
                    // console.log("line(data):", line(data));
                    return line(d.points);
                // }  
            })
            .attr("style", "marker-end: url(#arrow);");

        // Remove any links exiting.
        link.exit().transition()
            // .duration(duration)
            // .attr("d", d => {
            //     let o = {x: d.source.x ? d.source.x : 0, y: d.source.y ? d.source.y + d.source.size[1] / 2 : 0};
            //     return diagonal({source: o, target: o});
            // })
            .remove();

        /*
        /* ===== Post processing =====
        */

        // Record the old positions.
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    /* Event Handler */

    // collapse/unfold one layer on click, and compute doi then update.
    function click(n) {
        n.is_fold = !n.is_fold;
        update(nodes);
        // if (d.children) {
        //     collapse(d);
        // } else {
        //     d.children = d._children;
        //     d._children = null;
        // }
        // computeDOI(d);
    }

    function dblclick(n) {
    }

    function brushStart() {
    }

    function brushMove() {
    }

    function brushEnd() {
        let extent = brush.extent();
        let selectedNodes = [];
        let [dnodes, links] = getNodesAndLinks(nodes);
        dnodes.forEach(n => {
            let x1 = n.x - n.size[0] / 2;
            let y1 = n.y - n.size[1] / 2;
            let x2 = x1 + n.size[0];
            let y2 = y1 + n.size[1];
            if (isNodeInBox(x1, y1, extent) && isNodeInBox(x2, y2, extent))
                selectedNodes.push(n.id);
        })

        // close brush area
        brushg.selectAll("rect.extent")
            .attr("weight", 0)
            .attr("height", 0);

        function isNodeInBox(x, y, box) {
            if (box[0][0] <= x && x <= box[1][0] &&
                box[0][1] <= y && y <= box[1][1])
                return true;
            else
                return false;
        }

        // 框多个节点是合并，框一个节点是Zoom in
        if (selectedNodes.length == 1) {
            untieNodes(nodes, selectedNodes[0]);
        } else {
            mergeNodes(nodes, selectedNodes);
        }
        update(nodes);
    }
    

    // // Collapse nodes according to DOI
    // function collapseDOI(d, doiThreshold) {
    //     // first restore children then collapse
    //     if (!d.children && d._children) {
    //         d.children = d._children;
    //         d._children = null;
    //     }

    //     if (d.children) {
    //         d.children.forEach(n => collapseDOI(n, doiThreshold));
    //         if(d.doi < doiThreshold) {
    //             collapse(d);
    //         }
    //     } 
        
    //     // if (d.children && d.doi < doiThreshold) {
    //     //     d._children = d.children;
    //     //     d._children.forEach(d => collapseDOI(d, doiThreshold));
    //     //     d.children = null;
    //     // }
    //     // else if(d.doi >= doiThreshold && d.children === null)
    //     // {
    //     //     if()
    //     //     d.children = d._children;
    //     //     d.children.forEach(d => collapseDOI(d, doiThreshold));
    //     //     d._children = null;
    //     // }
    // }

    // Collapse nodes
    // function collapse(d) {
    //     if (d.children) {
    //         d._children = d.children;
    //         d._children.forEach(collapse);
    //         d.children = null;
    //     }
    // }
}