/*
/* Cfg viewer V0.2
*/

d3.json('data/root.json', d => {
    spaceTree(d);
});

function spaceTree(root, {
    width = 1024, // outer width, in pixels
    height = 1024, // outer height, in pixels
    margin = 100, // shorthand for margins
    marginTop = margin, // top margin, in pixels
    marginLeft = margin, // left margin, in pixels
    padding = 100, // padding around the labels
    duration = 350,
} = {})
{
    // separate algorithm
    // let separation = (a, b) => (a.parent == b.parent ? 1 : 2);
    const DOI_TYPE = {
        MOST_CARE: 1 << 0,
        MEDIEAN_CARE: 1 << 1,
        LITTLE_CARE: 1 << 2,
        DONT_CARE: 1 << 3
       }

    let tree = d3.flextree()
        .nodeSize(getNodeSize);
        // .spacing(separation);

    let diagonal = d3.svg.diagonal();
    let nodeMap = {};
    // init
    root = tree.hierarchy(root);
    computeDOI(root);
    root.each(node => {
        node.hue = Math.floor(Math.random() * 360);
        node.data.content.head.name = node.data.content.head.name ? node.data.content.head.name : "jmp";
        node.data.content.asm = node.data.content.asm ? node.data.content.asm : [];
        node.data.id = "" + node.data.id;
        nodeMap[node.data.id] = node;
    });
    // compute minSize of all nodes
    // const minSize = xy => node => node.nodes.reduce(
    // (min, node) => Math.min(min, getNodeSize(node)[xy]), Infinity);
    // const minXSize = minSize(0);
    // const minYSize = minSize(1);
    // const boxPadding = {
    //     side: minXSize(tree) * 0.1,
    //     bottom: minYSize(tree) * 0.2,
    //   };
    // console.log(minXSize);
    // console.log(minYSize);
    tree(root);
    const extents = root.extents;

    // const scale = Math.min(width / (extents.right - extents.left),
    // height / extents.bottom);

    // Center the tree.
    let svg = d3.select("body").append("svg")
        .attr("viewBox", [extents.left - width / 2, extents.top - padding, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10);
        // .attr('transform', `translate(${padding + transX} ${padding}) scale(${scale} ${scale})`);
    
    // start with only one root node
    click(root);
    update(root);
    // click(root);
    // click(root);
    // console.log(root);
    // console.log(tree.hierarchy(root));
    /* 
    /*   ==== function definitions ==== 
    */

    // function computeDepth(root) {
    //     let visited = new Set();
    //     function computeDepthHelper(node, depth) {
    //         if(!visited.has(node.data.id)) {
    //             node.depth = depth;
    //             visited.add(node.data.id);
    //             if(node.children) {
    //                 node.children.forEach(child => computeDepthHelper(child, depth + 1));
    //             }
    //         }
    //     }
    //     computeDepthHelper(root, 0);
    // }

    function getNodeSize(node) {
        // console.log(node);
        const xscale = 5;
        const yscale = 10;
        function getAsmLength(asm) {
            return (asm.addr + asm.mnemonic + asm.operands).length;
        }
        function getLongestAsmLength(node) {
            if(getAsmCount(node) == 0)  // only puts
                return getTitleLength(node);

            function getLongerAsm(asma, asmb) {
                return getAsmLength(asma) > getAsmLength(asmb) ? asma : asmb;
            }
            return getAsmLength(node.data.content.asm.reduce(getLongerAsm, {addr: "", mnemonic: "", operands: ""}));
        }
        function getAsmCount(node) {
            return node.data.content.asm.length;
        }
        function getTitleLength(node) {
            return node.data.content.head.name.length;
        }
        let result = [0, 0];
        
        if(node.doi_type == DOI_TYPE.MOST_CARE)
            result = [getLongestAsmLength(node) * xscale, Math.max(getAsmCount(node), 1) * yscale];  // full description
        else if(node.doi_type == DOI_TYPE.MEDIEAN_CARE)
            result = [getLongestAsmLength(node) * xscale, (getAsmCount(node) <= 1 ? 1 : 2) * yscale]; // display first and last asm / single put/jmp
        else
            result = [getTitleLength(node) * xscale, 1 * yscale];   // only titke is shown
        // console.log(result);
        // node.size = result;
        return result;
    }

    // precondition: every node have an id
    function computeDOI(source)
    {
        let visited = new Set();
        
        function DOIHelper(node, distance)
        {
            if(visited.has(node.data.id))
                return;

            visited.add(node.data.id);
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

    function isParent(nodeA, nodeB) {
        return (nodeA.parent && nodeA.parent.data.id == nodeB.data.id) || (nodeB.parent && nodeB.parent.data.id == nodeA.data.id);
    }

    function update(source) {
        // Compute the new tree layout.
        tree(root);
        let nodes = getNodesFromRoot(root);
        console.log("nodes:", nodes);
        // console.log("Nodes:");
        // console.log(nodes);
        // console.log("Sizes:");
        // nodes.forEach(n => console.log(n.data.id, n.size));
        let links = getLinkFromRoot(root, nodes);
        // console.log("Links:");
        console.log("links:",links);

        // dagre
        const g = new dagre.graphlib.Graph()
            .setGraph({ rankdir: "TB", marginx: 50, marginy: 50, ranksep: 55 })
            .setDefaultEdgeLabel(() => ({}));

        nodes.forEach(d => {
            g.setNode(d.data.id, { width: d.size[0], height: d.size[1] });
        });

        links.forEach(d => {
            g.setEdge(d.source.data.id, d.target.data.id);
        });

        dagre.layout(g);
        console.log(g);

        const dagreNode = g.nodes()
        .map(d => {
          const node = g.node(d);
          const nodeData = nodes.find(n => n.data.id == d);
          nodeData.x = node.x;
          nodeData.y = node.y;
          return nodeData;
        });

        console.log(dagreNode);
        const rootDagreNode = dagreNode.find(n => n.data.id == root.data.id);
        console.log("dagreNode:", dagreNode);


        // Update the nodes…
        // let node = svg.selectAll("g.node")
        //     .data(nodes, d => d.data.id);
        
        let node = svg.selectAll("g.node")
            .data(dagreNode, d => d.data.id);

        
        svg.attr("viewBox", [rootDagreNode.x - width / 2, rootDagreNode.y - 50, width, height]);

        /*
        /* ===== Node Processing =====
        */
        const roundScale = 5;
        // Entering
        let nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .on("click", click);
        
        // outer rect
        // nodeEnter.append("rect")
        //     .attr("rx", roundScale)
        //     .attr("ry", roundScale)
        //     .attr("width", 1e-6)
        //     .attr("height", 1e-6)
        //     .attr("x", n => n.x - n.size[0] / 2)
        //     .attr("y", n => n.y);

        // inner rect
        const boxPadding = {
            side: 5,
            bottom: 15
        };
        nodeEnter.append("g").append("rect")
            .attr("rx", roundScale)
            .attr("ry", roundScale)
            .attr("width", 1e-6)
            .attr("height", 1e-6)
            .attr("x", n => n.x - n.size[0] / 2 + boxPadding.side)
            .attr("y", n => n.y)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff");

        nodeEnter.append("text")
            .attr("text-anchor", "start")
            .style("fill-opacity", 1e-6);
        
        // use title to display doi
        nodeEnter.append("title")
            .text(d => "DOI: " + d.doi)

        // Updating: from origin pos to new pos
        // note: 3 levels of visualizing according to node's doi
        let nodeUpdate = node.transition()
            .duration(duration);

        // if(root.children)   // when sigleton, there is an error
        // nodeUpdate.attr("transform", d => `translate(${d.x},${d.y})`);
        
        /// update outer
        // nodeUpdate.select("rect")
        //     .attr("x", n => n.x - n.size[0] / 2)
        //     .attr("y", n => n.y)
        //     .attr("width", n => n.size[0])
        //     .attr("height", n => n.size[1]);
        // update inner
        nodeUpdate.select("g").select("rect")
        .attr("class", "inner-box")
        .attr("x", n => n.x - n.size[0] / 2 + boxPadding.side)
        .attr("y", n => n.y - n.size[1] / 2)
        .attr("width", n => n.size[0] - 2 * boxPadding.side)
        // .attr("height", n => n.size[1] - boxPadding.bottom )
        .attr("height", n => n.size[1])
        .style("fill", d => d._children ? `hsl(${d.hue}, 100%, 90%)` : "#fff");

        // note: for the biggest node, we need to slightly add x for better visualization
        nodeUpdate.select("text")
            .text(d => d.data.content.head.name)
            .style("fill-opacity", d => d.doi_type != DOI_TYPE.LITTLE_CARE ? 1 : 1e-6)
            // .attr("transform", d => `translate(${d.y},${d.x})`)
            // .attr("dy", "0.32em")
            // .attr("x", d => {
            //     if(d.doi == source.doi)
            //         return (d => d.children) ? -13 : 13;
            //     else 
            //         return (d => d.children) ? -10 : 10;
            // })
            .attr("x", n => n.x - n.size[0] / 2)
            .attr("y", n => n.y);
            // .attr("text-anchor", d => d.children ? "end" : "start");
            // Better presentation yet with low efficiency -- draw much lags
            // .attr("paint-order", "stroke")
            // .attr("stroke", halo)
            // .attr("stroke-width", haloWidth);
        
        nodeUpdate.select("title")
            .text(d => "DOI: " + d.doi)
            
        // Exiting
        let nodeExit = node.exit().transition()
            .duration(duration)
            .remove();

        nodeExit.select("rect")
            .attr("width", 1e-6)
            .attr("height", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        /*
        /* ===== Link Processing =====
        */

        // Entering
        const edges = g.edges()
            .map(d => {
                console.log("d:", d);
                const edge = g.edge(d);
                const edgeData = links.find(e => e.source.data.id == d.v && e.target.data.id == d.w);
                console.log("edge:", edge);
                console.log("edgeData:", edgeData);
                edge.source = edgeData.source;
                edge.target = edgeData.target;
                return edge;
            })
        console.log("darge edges:", edges);

        let link = svg
            .selectAll("path.link")
            .data(edges, d => d.source.data.id + "," +  d.target.data.id);
        
        

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
        .attr("class", "link")
        // .attr('marker-end', 'url(#arrow)')
        .attr("d", d => {
            let o = {x: source.x0 ? source.x0 : 0, y: source.y0  ? source.y0 + source.size[1] : 0};
            return diagonal({source: o, target: o});
        });

        
        // Set links to their new pos.
        let line = d3.svg.line()
                    .x(d =>  { return d.x; })
                    .y(d => { return d.y; })
                    .interpolate("basis");

        link.transition()
            .duration(duration)
            .attr("d", d => {
                // console.log(d);
                // let s = {x: d.source.x, y: d.source.y + d.source.size[1] - boxPadding.bottom};
                
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
                    
            });

        // Remove any links exiting.
        link.exit().transition()
            .duration(duration)
            .attr("d", d => {
                let o = {x: source.x ? source.x : 0, y: source.y ? source.y + source.size[1] / 2 : 0};
                return diagonal({source: o, target: o});
            })
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

    // collapse/unfold one layer on click, and compute doi then update.
    function click(d) {
        if (d.children) {
            collapse(d);
        } else {
            d.children = d._children;
            d._children = null;
        }
        computeDOI(d);
        update(d);
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
    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }
}