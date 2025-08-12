// src/components/ProgressMap.jsx
import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import useAppStore from '../state/useAppStore.js'

export default function ProgressMap(){
  const roadmap = useAppStore(s => s.roadmap)
  const setNodeStatus = useAppStore(s => s.setNodeStatus)
  const resetNode = useAppStore(s => s.resetNode)

  // Rebuild the sim only when the set of IDs changes
  const idsSig = useMemo(() => roadmap.map(r => r.id).join('|'), [roadmap])

  // Fast status lookup (for color updates)
  const statusById = useMemo(() => {
    const m = new Map()
    roadmap.forEach(r => m.set(r.id, r.status))
    return m
  }, [roadmap])

  // Simple sequential links (customize if you have real prereqs)
  const linksData = useMemo(() => {
    return roadmap.slice(1).map((r, i) => ({ source: roadmap[i].id, target: r.id }))
  }, [idsSig])

  const ref = useRef(null)
  const positionsRef = useRef({}) // { [id]: { x, y } }
  const simRef = useRef(null)
  const nodeSelRef = useRef(null)
  const circSelRef = useRef(null)
  const linkSelRef = useRef(null)
  const nodesRef = useRef([])

  const nextStatus = (s) =>
    s === 'not-started' ? 'in-progress' : s === 'in-progress' ? 'done' : 'not-started'

  const color = (s) =>
    s === 'done' ? '#22c55e' : s === 'in-progress' ? '#f59e0b' : '#64748b'

  // Wrap & center text inside the node (up to 2 lines)
  function wrapAndCenter(selection, maxWidth = 78, maxLines = 2, lineHeight = 12) {
    selection.each(function(d) {
      const text = d3.select(this)
      const words = String(d.title || '').split(/\s+/).filter(Boolean)
      text.selectAll('tspan').remove()

      const temp = text.append('tspan').attr('x', 0).attr('y', 0)
      const lines = []
      let current = []

      // Greedy line build
      for (let i = 0; i < words.length; i++) {
        current.push(words[i])
        temp.text(current.join(' '))
        if (temp.node().getComputedTextLength() > maxWidth) {
          current.pop()
          temp.text(current.join(' '))
          lines.push(current.join(' '))
          current = [words[i]]
        }
      }
      if (current.length) lines.push(current.join(' '))

      // Cap at maxLines with ellipsis
      if (lines.length > maxLines) {
        lines.length = maxLines
        let last = lines[maxLines - 1]
        if (last.length > 1) {
          let trimmed = last
          temp.text(trimmed + '…')
          while (temp.node().getComputedTextLength() > maxWidth && trimmed.length > 1) {
            trimmed = trimmed.slice(0, -1)
            temp.text(trimmed + '…')
          }
          lines[maxLines - 1] = trimmed + '…'
        }
      }

      temp.remove()

      // Vertical centering
      const totalHeight = (lines.length - 1) * lineHeight
      const startDy = -totalHeight / 2

      lines.forEach((line, i) => {
        text.append('tspan')
          .attr('x', 0)
          .attr('dy', i === 0 ? startDy : lineHeight)
          .text(line)
      })
    })
  }

  // Build the simulation ONLY when IDs change
  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.innerHTML = ''
    const width = el.clientWidth || 600
    const height = 420

    const svg = d3.select(el)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    const nodes = roadmap.map(r => {
      const saved = positionsRef.current[r.id]
      return {
        ...r,
        x: saved?.x ?? (Math.random() * width),
        y: saved?.y ?? (Math.random() * height)
      }
    })
    nodesRef.current = nodes

    const idIndex = new Map(nodes.map((d, i) => [d.id, i]))
    const links = linksData.map(l => ({
      source: idIndex.get(l.source),
      target: idIndex.get(l.target)
    }))

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).distance(120))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width/2, height/2))
      .force('collision', d3.forceCollide().radius(40))
    simRef.current = sim

    // Links
    const gLinks = svg.append('g').attr('stroke', 'var(--border)').attr('stroke-opacity', 0.6)
    const linkSel = gLinks.selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 2)
    linkSelRef.current = linkSel

    // Nodes
    const gNodes = svg.append('g').attr('pointer-events', 'all')
    const nodeSel = gNodes.selectAll('g')
      .data(nodes, d => d.id)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (evt, d) => {
        if (evt.shiftKey) {
          const wasDone = d.status === 'done'
          const ok = wasDone ? confirm('This node is completed. Reset to "Not started"? XP will NOT be re-awarded later.') : true
          if (ok) resetNode(d.id)
          return
        }
        setNodeStatus(d.id, nextStatus(d.status))
      })
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0)
          d.fx = null; d.fy = null
        }))
    nodeSelRef.current = nodeSel

    const circSel = nodeSel.append('circle')
      .attr('r', 22)
      .attr('fill', d => color(d.status))
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 2)
    circSelRef.current = circSel

    // Full title tooltip
    nodeSel.append('title').text(d => d.title)

    // Wrapped, centered label
    const label = nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 11)
      .attr('fill', 'white')
      .style('font-family', `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif`)
      .attr('y', 0)

    // Clear default text then wrap
    label.each(function(){ d3.select(this).text('') })
    wrapAndCenter(label, 78, 2, 12)

    // Ticks
    sim.on('tick', () => {
      linkSel
        .attr('x1', d => nodes[d.source.index].x)
        .attr('y1', d => nodes[d.source.index].y)
        .attr('x2', d => nodes[d.target.index].x)
        .attr('y2', d => nodes[d.target.index].y)

      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`)

      // persist positions
      for (const n of nodes) positionsRef.current[n.id] = { x: n.x, y: n.y }
    })

    return () => sim.stop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSig])

  // Update colors when statuses change (no rebuild)
  useEffect(() => {
    if (!circSelRef.current || !nodesRef.current) return
    nodesRef.current.forEach(n => {
      const st = statusById.get(n.id)
      if (st) n.status = st
    })
    circSelRef.current.attr('fill', d => color(statusById.get(d.id) || d.status))
  }, [statusById])

  return (
    <div className="map-card">
      <div className="map-legend">
        <span><i className="dot done" /> Done</span>
        <span><i className="dot prog" /> In progress</span>
        <span><i className="dot nots" /> Not started</span>
        <span className="muted">Click to cycle • <strong>Shift+Click</strong> to reset</span>
      </div>
      <div ref={ref} className="map-canvas" />
    </div>
  )
}
