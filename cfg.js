/*
/* Cfg viewer V0.1
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
    let separation = (a, b) => (a.parent == b.parent ? 1 : 2);

    let tree = d3.flextree()
        .nodeSize([10, 10])
        .spacing(separation);

    let diagonal = d3.svg.diagonal();

    // init
    root = tree.hierarchy(root);
    tree(root);
    const extents = root.extents;
    console.log(extents);
    console.log(tree.dump(root));

    // const scale = Math.min(width / (extents.right - extents.left),
    // height / extents.bottom);

    // Center the tree.
    let svg = d3.select("body").append("svg")
        .attr("viewBox", [extents.left - padding, extents.top - padding, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10);
        // .attr('transform', `translate(${padding + transX} ${padding}) scale(${scale} ${scale})`);

    // start with only one root node
    computeDOI(root);
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

    // precondition: every node have an id
    function computeDOI(source)
    {
        let visited = new Set();
        
        function DOIHelper(node, distance)
        {
            if(visited.has(node))
                return;

            visited.add(node);
            node.doi = -node.depth - distance;
            
            if(node.children)
            {
                node.children.forEach(n => {
                    DOIHelper(n, distance + 1);
                });
            }

            if(node.parent)
                DOIHelper(node.parent, distance + 1);
            
        }

        DOIHelper(source, 0);
    }

    

    function getLinkFromRoot(root) {
        // linK: {source: node, target: node}
        let visited = new Set();
        let links = [];
        getLink(root);
        function getLink(node) {
            if(!visited.has(node.data.id)) {
                visited.add(node.data.id);
                if(node.children) {
                    node.children.forEach(child => {
                        links.push({
                            source: node,
                            target: child
                        });
                        getLink(child);
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
                nodes.push(node);
                if(node.children) {
                    node.children.forEach(child => getNode(child));
                }
            }
        }
        return nodes;
    }

    function update(source) {
        // Compute the new tree layout.
        tree(root);
        let nodes = getNodesFromRoot(root);
        console.log("Nodes:");
        console.log(nodes);
        let links = getLinkFromRoot(root);
        console.log("Links:");
        console.log(links);
        // Update the nodes…
        let node = svg.selectAll("g.node")
            .data(nodes, d => d.data.id);

        /*
        /* ===== Node Processing =====
        */

        // Entering
        let nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .on("click", click);

        nodeEnter.append("circle")
            .attr("r", 1e-6)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff");

        nodeEnter.append("text")
            .text(d => d.data.content.head.name)
            .style("fill-opacity", 1e-6);
        
        // use title to display doi
        nodeEnter.append("title")
            .text(d => "DOI: " + d.doi)

        // Updating: from origin pos to new pos
        // note: 3 levels of visualizing according to node's doi
        let nodeUpdate = node.transition()
            .duration(duration);

        // if(root.children)   // when sigleton, there is an error
        nodeUpdate.attr("transform", d => `translate(${d.x},${d.y})`);
            
        nodeUpdate.select("circle")
            .attr("r", d => {
                return 6;
                // if(d.doi == source.doi)
                //     return 10;
                // else if(d.doi == source.doi - 2)
                //     return 6;
                // else if(d.doi == source.doi - 3)
                //     return 3;
                // else
                //     return 6;   // yet stroke becomes white
            })
            .style("stroke", d => {
                return "steelblue"
                // if(d.doi < source.doi - 3)
                //     return "#fff";
                // else
                //     return "steelblue";
            })
            .style("fill", d => d._children ? "lightsteelblue" : "#fff");
        

        // note: for the biggest node, we need to slightly add x for better visualization
        nodeUpdate.select("text")
            .style("fill-opacity", d => d.doi >= source.doi - 3 ? 1 : 1e-6)
            // .attr("transform", d => `translate(${d.y},${d.x})`)
            .attr("dy", "0.32em")
            .attr("x", d => {
                if(d.doi == source.doi)
                    return (d => d.children) ? -13 : 13;
                else 
                    return (d => d.children) ? -10 : 10;
            })
            .attr("text-anchor", d => d.children ? "end" : "start");
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

        nodeExit.select("circle")
            //.attr("stroke", "rgb(255, 255, 255)");
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        /*
        /* ===== Link Processing =====
        */

        // Entering
        let link = svg
            .selectAll("path.link")
            .data(links, d => d.target.data.id);

        // Add new links at source's old pos
        link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("d", d => {
            let o = {x: source.x0 ? source.x0 : 0, y: source.y0 ? source.y0 : 0};
            return diagonal({source: o, target: o});
        });

        // Set links to their new pos.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);

        // Remove any links exiting.
        link.exit().transition()
            .duration(duration)
            .attr("d", d => {
                let o = {x: source.x ? source.x : 0, y: source.y ? source.y : 0};
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

        console.log(svg);
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