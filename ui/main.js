import React, {Component} from 'react';
import {render} from 'react-dom';
import {UndirectedGraph} from 'graphology';
import WebGLRenderer from 'sigma/renderers/webgl';
import circularLayout from 'graphology-layout/circular';
import {inferSettings} from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import extent from 'simple-statistics/src/extent';
import {scaleLinear} from 'd3-scale';
import EventEmitter from 'events';

import DATA from '../data.json';

const PALETTE = [
  '#ce6f3b',
  '#7b66cf',
  '#64ac48',
  '#c84fb4',
  '#4aac8b',
  '#cf5062',
  '#628ccb',
  '#a39440',
  '#d68cc6',
  '#9c4a7b'
];

const MACRO_SOURCE = new EventEmitter(),
      MICRO_SOURCE = new EventEmitter();

class Network extends Component {
  constructor(props) {
    super(props);

    this.container = React.createRef();
    this.layoutSettings = inferSettings(this.props.graph);

    this.handleLayout = this.handleLayout.bind(this);
  }

  spawnRenderer() {
    this.renderer = new WebGLRenderer(this.props.graph, this.container.current);
    this.layout = new FA2Layout(this.props.graph, {settings: inferSettings(this.props.graph)});
    this.layout.start();

    if (this.props.own) {
      // TODO: fix in sigma
      var nodes = new Set();
      this.renderer.on('overNode', data => {
        nodes.add(data.node);
        this.props.own.emit('over', data.node);
      });

      this.renderer.on('outNode', data => {
        nodes.forEach(node => this.props.own.emit('out', node));
        nodes.clear();
      });
    }

    if (this.props.other) {
      this.props.other.on('over', node => {
        if (this.props.graph.hasNode(node))
          this.renderer.highlightNode(node);
      });

      this.props.other.on('out', node => {
        if (this.props.graph.hasNode(node))
          this.renderer.unhighlightNode(node);
      });
    }
  }

  componentDidMount() {
    this.spawnRenderer();
  }

  componentDidUpdate() {

    if (this.renderer) {
      this.renderer.kill();
      this.layout.kill();
    }

    this.spawnRenderer();
  }

  handleLayout() {
    this.layout.stop();
  }

  render() {
    const offset = this.props.offset || 0;

    return (
      <div style={{height: '100%', width: '100%'}}>
        <div style={{height: `calc(100% - ${offset}px)`, width: '100%', top: `${offset}px`, position: 'absolute'}} ref={this.container} />
        <button
          style={{position: 'absolute', top: `${10 + offset}px`, left: '10px', zIndex: 30}}
          onClick={this.handleLayout}>
          Stop Layout
        </button>
        <p style={{position: 'absolute', top: `${20 + offset}px`, left: '10px', zIndex: 30}}>
          Threshold: {this.props.threshold.toFixed(2)}
        </p>
      </div>
    );
  }
}

class CommunitySelector extends Component {
  constructor(props) {
    super(props);

    this.state = {
      selected: 0
    };

    this.handleSelect = this.handleSelect.bind(this);
  }

  handleSelect(e) {
    this.setState({selected: e.target.value});
  }

  render() {
    const selected = this.props.communities[this.state.selected];

    return (
      <div style={{height: '100%', width: '100%'}}>
        <select value={this.state.selected} onChange={this.handleSelect}>
          {this.props.communities.map((c, i) => {
            return (
              <option key={i} value={i} style={{backgroundColor: c.color}}>{c.label}</option>
            );
          })}
        </select>
        <Network
          graph={selected.graph}
          threshold={selected.threshold}
          own={MICRO_SOURCE}
          other={MACRO_SOURCE}
          offset={40} />
      </div>
    );
  }
}

function App(props) {
  return (
    <div style={{width: '100%', height: '100%'}}>
      <div style={{height: '100%', width: '50%', position: 'absolute'}}>
        <Network
          graph={props.macro}
          threshold={props.threshold}
          own={MACRO_SOURCE}
          other={MICRO_SOURCE} />
      </div>
      <div style={{height: '100%', width: '50%', position: 'absolute', left: '50%'}}>
        <CommunitySelector communities={props.communities} />
      </div>
    </div>
  );
}

// Processing data
const communities = DATA.micro.map(m => new Set(m.nodes));

const macro = new UndirectedGraph();

DATA.macro.edges.forEach(([source, target, similarity]) => {
  macro.mergeEdge(source, target, {similarity});
});

const nodeMacroScale = scaleLinear()
  .domain(extent(macro.nodes().map(n => macro.degree(n))))
  .range([2, 7]);

macro.forEachNode(node => {
  macro.mergeNodeAttributes(node, {
    size: nodeMacroScale(macro.degree(node)),
    label: node
  });
});

communities.forEach((c, i) => {
  c.forEach(node => {
    macro.mergeNodeAttributes(node, {
      community: i,
      color: PALETTE[i]
    });
  });
});

circularLayout.assign(macro);

communities.forEach((c, i) => {
  const g = new UndirectedGraph();

  const d = DATA.micro[i];

  c.forEach(node => g.addNode(node, {label: node, color: PALETTE[i]}));

  d.edges.forEach(([source, target, similarity]) => {
    g.addEdge(source, target, {similarity});
  });

  const nodeScale = scaleLinear()
    .domain(extent(g.nodes().map(n => g.degree(n))))
    .range([2, 7]);

  g.forEachNode(node => g.setNodeAttribute(node, 'size', nodeScale(g.degree(node))));

  circularLayout.assign(g);

  const bestLabel = Array.from(c)
    .map(n => ({node: n, degree: macro.degree(n)}))
    .sort((a, b) => b.degree - a.degree)[0];

  DATA.micro[i].graph = g;
  DATA.micro[i].label = bestLabel.node;
  DATA.micro[i].color = PALETTE[i];
});

// Rendering
const body = (
  <App
   macro={macro}
   threshold={DATA.macro.threshold}
   communities={DATA.micro} />
)

render(body, document.getElementById('app'));
