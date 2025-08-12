import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { invoke } from '@tauri-apps/api/core'
import { supabase, enabled as supaEnabled } from '../lib/supabase'

// slug
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item'
}

// ---- level helpers ----
const LEVEL_THRESHOLDS = [0,200,500,900,1400,2000,2700,3500,4400,5400]
const RANK_TITLES = [
  'Newcomer','Apprentice','Junior Tinkerer','Prompt Explorer',
  'Model Wrangler','AI Builder','Systems Thinker','Optimization Guru',
  'Research Adept','AI Specialist'
]
function levelFromXp(xp){ let lvl=1; for(let i=0;i<LEVEL_THRESHOLDS.length;i++){ if(xp>=LEVEL_THRESHOLDS[i]) lvl=i+1 } return Math.min(lvl,LEVEL_THRESHOLDS.length)}
function nextLevelXp(xp){ const lvl=levelFromXp(xp); const idx=Math.min(lvl,LEVEL_THRESHOLDS.length-1); const cur=LEVEL_THRESHOLDS[idx-1]??0; const next=LEVEL_THRESHOLDS[idx]??LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length-1]; return {currentLevel:lvl,cur,next}}

// ---- roadmap base ----
const initialRoadmap = []

// default node details (resources + tasks + challenge)
function defaultDetailsFor(node){
  const title = (node?.title || 'Topic').trim()
  const q = encodeURIComponent(title)
  return {
    resources: [
      { id:'r1', kind:'doc',   title:`Wikipedia: ${title}`, url:`https://en.wikipedia.org/wiki/${q}` },
      { id:'r2', kind:'video', title:`YouTube: ${title} tutorial`, url:`https://www.youtube.com/results?search_query=${q}+tutorial` },
      { id:'r3', kind:'repo',  title:`GitHub search: ${title}`, url:`https://github.com/search?q=${q}` }
    ],
    tasks: [
      { id:'t1', text:`Skim the Wikipedia page and note 5 key terms for "${title}".`, done:false },
      { id:'t2', text:`Watch a 10–20 min video tutorial on "${title}".`, done:false },
      { id:'t3', text:`Build a tiny demo or write a 15-line example related to "${title}".`, done:false }
    ],
    challenge: {
      id:'c1',
      prompt:`In 3–6 sentences, explain the core idea of "${title}" and provide a concrete example (with code or pseudo-code if applicable).`,
      passed:false,
      requirements: undefined, // filled by AI
      rubric: undefined        // filled by AI
    }
  }
}

// ---- helpers to enforce completion & award XP once ----
function nodeEligible(details){
  const allTasksDone = (details?.tasks || []).every(t => t.done)
  const challengePassed = !!details?.challenge?.passed
  return allTasksDone && challengePassed
}

const useAppStore = create(
  persist(
    (set, get) => ({

      // THEME
      theme: 'dark',
      toggleTheme: () => set(t => ({ theme: t.theme === 'dark' ? 'light' : 'dark' })),

      // Reset only local state (will get overwritten by server on next pull)
resetLocalState: () => {
  set({
    theme: 'dark',
    roadmap: [],
    nodeDetails: {},
    tasks: [],
    streak: 0,
    lastCompleted: null,
    xp: 0,
    achievements: [],
    settings: { assistantModel:'gpt-4o-mini' },
    lastSync: get().lastSync // keep sync metadata untouched
  })
},

// Reset local AND overwrite cloud immediately
resetEverywhere: async () => {
  // 1) stop auto-sync momentarily
  const wasAuto = get().autoSync
  set({ autoSync: false })

  // 2) clear local
  get().resetLocalState()

  // 3) push this empty profile to the server (overwrites)
  try {
    const u = await get().getUser()
    if (u) {
      await get().syncPush()
    }
  } finally {
    // 4) re-enable auto-sync
    set({ autoSync: wasAuto })
  }
},


      // --- NEW: sync knobs/state ---
      autoSync: true,
      setAutoSync: (v) => set({ autoSync: !!v }),
      syncStatus: 'idle', // 'idle' | 'pulling' | 'pushing' | 'synced' | 'offline' | 'error'
      setSyncStatus: (status) => set({ syncStatus: status }),

      // ROADMAP
      roadmap: initialRoadmap,   // items include: { id,title,status,estHours,completedAt?,xpAwarded? }
      nodeDetails: {},           // { [nodeId]: { resources, tasks, challenge } }

      ensureNodeDetails: (id) => {
        const { roadmap, nodeDetails } = get()
        if (!nodeDetails[id]) {
          const node = roadmap.find(n => n.id === id) || { id, title: id }
          set({ nodeDetails: { ...nodeDetails, [id]: defaultDetailsFor(node) } })
        }
      },

      // Reset a node back to "not-started" without re-awarding XP later
      resetNode: (id) => {
        set(s => ({
          roadmap: s.roadmap.map(n => {
            if (n.id !== id) return n
            return {
              ...n,
              status: 'not-started',
              xpAwarded: n.xpAwarded ?? true, // prevent XP farming
              completedAt: null
            }
          })
        }))
      },

      // Tailored challenge requirements via backend AI
      fetchChallengeSpec: async (nodeId) => {
        const { nodeDetails, roadmap, settings } = get()
        if (nodeDetails[nodeId]?.challenge?.requirements?.length) return
        const node = roadmap.find(n => n.id === nodeId)
        const seeded = nodeDetails[nodeId] ?? defaultDetailsFor(node)
        const tasks = (seeded.tasks || []).map(t => t.text)

        try {
          const res = await invoke('generate_challenge_spec', {
            payload: {
              title: node?.title || nodeId,
              tasks,
              level: 'beginner',
              model: settings?.assistantModel || 'gpt-4o-mini'
            }
          })
          const current = get().nodeDetails[nodeId] ?? seeded
          set({
            nodeDetails: {
              ...get().nodeDetails,
              [nodeId]: {
                ...current,
                challenge: {
                  ...(current.challenge || {}),
                  requirements: res.requirements || [],
                  rubric: res.rubric || current.challenge?.rubric
                }
              }
            }
          })
        } catch (e) {
          console.warn('generate_challenge_spec fallback:', e)
          // keep defaults; UI still works
        }
      },

      // Normalize items & add guard fields
      setRoadmap: (items) => set(() => {
        const arr = Array.isArray(items) ? items : []
        const used = new Set()
        const normalized = arr.map((n, idx) => {
          const rawTitle = n?.title ?? `Item ${idx + 1}`
          const title = String(rawTitle).trim() || `Item ${idx + 1}`
          let id = (n?.id && String(n.id).trim()) || slugify(title)
          let base = id, k = 1
          while (used.has(id)) id = `${base}-${k++}`
          used.add(id)
          const est = Number(n?.estHours)
          return {
            id,
            title,
            status: ['not-started','in-progress','done'].includes(n?.status) ? n.status : 'not-started',
            estHours: Number.isFinite(est) && est > 0 ? est : 8,
            completedAt: n?.completedAt || null,
            xpAwarded: !!n?.xpAwarded
          }
        })
        return { roadmap: normalized }
      }),

      // Toggle a node task; auto-mark in-progress and auto-complete if eligible
      toggleNodeTask: (nodeId, taskId) => {
        set(s => {
          const current = s.nodeDetails[nodeId] ?? defaultDetailsFor(s.roadmap.find(n => n.id === nodeId))
          const tasks = (current.tasks || []).map(t => t.id === taskId ? { ...t, done: !t.done } : t)
          const anyDone = tasks.some(t => t.done)

          // bump to in-progress if any task is done
          let roadmap = s.roadmap.map(n =>
            n.id === nodeId && n.status === 'not-started' ? { ...n, status: 'in-progress' } : n
          )

          // auto-complete if eligible (and award once)
          const tempDetails = { ...current, tasks }
          if (nodeEligible(tempDetails)) {
            roadmap = roadmap.map(n => {
              if (n.id !== nodeId) return n
              if (n.status !== 'done') {
                const updated = { ...n, status: 'done', completedAt: n.completedAt || new Date().toISOString() }
                if (!n.xpAwarded) {
                  get().addXp(100)
                  get().maybeUnlock('first-node','First Steps','Completed your first roadmap node.')
                  updated.xpAwarded = true
                }
                return updated
              }
              return n
            })
          }

          return {
            nodeDetails: { ...s.nodeDetails, [nodeId]: { ...current, tasks } },
            roadmap
          }
        })
      },

      // Mark challenge pass/fail; if pass + tasks done -> auto complete
      setChallengePassed: (nodeId, passed) => {
        set(s => {
          const nd = s.nodeDetails
          const d = nd[nodeId] || defaultDetailsFor(s.roadmap.find(n => n.id === nodeId))
          const challenge = { ...d.challenge, passed: !!passed }
          let roadmap = s.roadmap

          if (nodeEligible({ ...d, challenge })) {
            roadmap = roadmap.map(n => {
              if (n.id !== nodeId) return n
              if (n.status !== 'done') {
                const updated = { ...n, status: 'done', completedAt: n.completedAt || new Date().toISOString() }
                if (!n.xpAwarded) {
                  get().addXp(100)
                  get().maybeUnlock('first-node','First Steps','Completed your first roadmap node.')
                  updated.xpAwarded = true
                }
                return updated
              }
              return n
            })
          }

          return { nodeDetails: { ...nd, [nodeId]: { ...d, challenge } }, roadmap }
        })
      },

      // Guarded status setter with "done" lock and XP-once
      setNodeStatus: (id, status) => {
        const { nodeDetails, roadmap } = get()
        const current = roadmap.find(n => n.id === id)
        if (!current) return

        // If already done, treat as read-only (ignore edits)
        if (current.status === 'done' && status !== 'done') {
          alert('Completed nodes are read-only.')
          return
        }

        if (status === 'done') {
          const details = nodeDetails[id] || defaultDetailsFor(current)
          if (!nodeEligible(details)) {
            alert('Complete all tasks and pass the challenge before marking as Done.')
            return
          }
        }

        set(s => ({
          roadmap: s.roadmap.map(n => {
            if (n.id !== id) return n
            if (status === 'done') {
              const updated = { ...n, status: 'done', completedAt: n.completedAt || new Date().toISOString() }
              if (!n.xpAwarded) {
                get().addXp(100)
                get().maybeUnlock('first-node','First Steps','Completed your first roadmap node.')
                updated.xpAwarded = true
              }
              return updated
            }
            return { ...n, status }
          })
        }))
      },

      // ----- EXPORT / IMPORT (for manual backup & for sync) -----
      exportState: () => {
        const s = get()
        return {
          theme: s.theme,
          roadmap: s.roadmap,
          nodeDetails: s.nodeDetails,
          tasks: s.tasks,
          streak: s.streak,
          lastCompleted: s.lastCompleted,
          xp: s.xp,
          achievements: s.achievements,
          settings: s.settings
        }
      },

      importState: (doc) => {
        try {
          if (!doc || typeof doc !== 'object') throw new Error('Bad document')
          const roadmap = Array.isArray(doc.roadmap) ? doc.roadmap : []
          const nodeDetails = doc.nodeDetails && typeof doc.nodeDetails === 'object' ? doc.nodeDetails : {}
          const tasks = Array.isArray(doc.tasks) ? doc.tasks : []
          const streak = Number.isFinite(doc.streak) ? doc.streak : 0
          const lastCompleted = typeof doc.lastCompleted === 'string' || doc.lastCompleted === null ? doc.lastCompleted : null
          const xp = Number.isFinite(doc.xp) ? doc.xp : 0
          const achievements = Array.isArray(doc.achievements) ? doc.achievements : []
          const settings = doc.settings && typeof doc.settings === 'object' ? doc.settings : { assistantModel: 'gpt-4o-mini' }

          set({
            theme: doc.theme === 'light' ? 'light' : 'dark',
            roadmap,
            nodeDetails,
            tasks,
            streak,
            lastCompleted,
            xp,
            achievements,
            settings
          })
          return true
        } catch (e) {
          console.warn('importState failed:', e)
          return false
        }
      },

      // ----- AUTH -----
      getUser: async () => {
  if (!supaEnabled || !supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user || null
},
signUp: async (email, password) => {
  if (!supaEnabled || !supabase) throw new Error('Cloud sync is disabled (Supabase not configured).')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data.user
},
signIn: async (email, password) => {
  if (!supaEnabled || !supabase) throw new Error('Cloud sync is disabled (Supabase not configured).')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
},
signOut: async () => {
  if (!supaEnabled || !supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
},

      // ----- SYNC PUSH / PULL -----
      syncPush: async () => {
        const user = await get().getUser()
        if (!supaEnabled || !supabase) return { disabled: true }
        const doc = get().exportState()

        get().setSyncStatus('pushing') // NEW
        const { data: existing, error: selErr } = await supabase
          .from('profiles')
          .select('version')
          .eq('user_id', user.id)
          .maybeSingle()
        if (selErr) { get().setSyncStatus('error'); throw selErr }

        const nextVersion = (existing?.version || 0) + 1

        const { error: upErr } = await supabase
          .from('profiles')
          .upsert({
            user_id: user.id,
            doc,
            version: nextVersion,
            updated_at: new Date().toISOString()
          })
        if (upErr) { get().setSyncStatus('error'); throw upErr }

        set({ lastSync: { ...(get().lastSync||{}), lastPushAt: new Date().toISOString(), version: nextVersion } })
        get().setSyncStatus('synced') // NEW
        return { version: nextVersion }
      },

      syncPull: async () => {
        const user = await get().getUser()
        if (!supaEnabled || !supabase) return { disabled: true }

        get().setSyncStatus('pulling') // NEW
        const { data, error } = await supabase
          .from('profiles')
          .select('doc, version, updated_at')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) { get().setSyncStatus('error'); throw error }

        if (!data?.doc) {
          set({ lastSync: { ...(get().lastSync||{}), lastPullAt: new Date().toISOString() } })
          get().setSyncStatus('synced') // nothing to import, but we're fine
          return { imported: false }
        }

        const ok = get().importState(data.doc)
        set({ lastSync: { version: data.version, lastPullAt: new Date().toISOString(), serverUpdatedAt: data.updated_at } })
        get().setSyncStatus('synced') // NEW
        return { imported: ok, version: data.version, updated_at: data.updated_at }
      },

      // Global tasks & streak
      tasks: [],
      addTask:(title, relatedNodeId)=>{
        const newTask = { id:Date.now(), title, relatedNodeId:relatedNodeId||null, done:false, created:new Date().toISOString() }
        set(s=>({ tasks:[newTask, ...s.tasks] }))
      },
      toggleTask:(id)=> set(s=>({ tasks: s.tasks.map(t=>t.id===id?{...t,done:!t.done}:t) })),
      clearDone:()=> set(s=>({ tasks: s.tasks.filter(t=>!t.done) })),
      streak:0,
      lastCompleted:null,
      completeTask:(id)=>{
        set(s=>{
          const updated = s.tasks.map(t=>t.id===id?{...t,done:true}:t)
          const today = new Date().toDateString()
          let streak = s.streak
          if (s.lastCompleted !== today) streak += 1
          return { tasks:updated, lastCompleted:today, streak }
        })
        const bonus = Math.min(get().streak*5, 25)
        get().addXp(50+bonus)
        get().maybeUnlock('streak-3','On a Roll','3-day completion streak.', ()=>get().streak>=3)
        get().maybeUnlock('streak-7','Habit Formed','7-day completion streak.', ()=>get().streak>=7)
      },

      // XP / LEVEL / RANK / ACHIEVEMENTS
      xp:0,
      addXp:(amount)=>{
        const prevXp = get().xp
        const newXp = prevXp + (Number(amount)||0)
        const prevLevel = levelFromXp(prevXp)
        const newLevel = levelFromXp(newXp)
        set({ xp:newXp })
        if (newLevel>prevLevel){
          const title = RANK_TITLES[newLevel-1] ?? 'AI Specialist'
          set(s=>({ achievements:[...s.achievements, { id:`level-${newLevel}`, title:`Level Up: ${newLevel} — ${title}`, detail:`Reached level ${newLevel}.`, earnedAt:new Date().toISOString() }] }))
        }
      },
      levelInfo:()=>{
        const xp = get().xp ?? 0
        const { currentLevel, cur, next } = nextLevelXp(xp)
        const title = RANK_TITLES[currentLevel-1] ?? 'AI Specialist'
        const denom = Math.max(1, next-cur)
        const pct = Math.min(1, Math.max(0, (xp-cur)/denom))
        return { xp, level: currentLevel, title, cur, next, pct }
      },
      achievements:[],
      hasAchievement:(id)=> !!get().achievements?.find(a=>a.id===id),
      maybeUnlock:(id,title,detail,cond=()=>true)=>{
        const list = get().achievements || []
        if (list.find(a=>a.id===id)) return
        if (!cond()) return
        set(s=>({ achievements:[...(s.achievements||[]), { id,title,detail,earnedAt:new Date().toISOString() }] }))
      },

      settings:{ assistantModel:'gpt-4o-mini' },
      updateSettings:(patch)=> set(s=>({ settings:{ ...s.settings, ...patch } })),

      // Optional: last sync metadata for UI
      lastSync: null,
    }),
    {
      name:'ai-dashboard-store',
      storage:createJSONStorage(()=>localStorage),
      version:6, // bump for autoSync/syncStatus
      migrate:(persisted)=>{
        const roadmap = (persisted?.roadmap || []).map(n => ({
          ...n,
          completedAt: n?.completedAt || null,
          xpAwarded: !!n?.xpAwarded
        }))
        return {
          theme: persisted?.theme ?? 'dark',
          roadmap,
          nodeDetails: persisted?.nodeDetails ?? {},
          tasks: persisted?.tasks ?? [],
          streak: persisted?.streak ?? 0,
          lastCompleted: persisted?.lastCompleted ?? null,
          xp: persisted?.xp ?? 0,
          achievements: persisted?.achievements ?? [],
          settings: persisted?.settings ?? { assistantModel:'gpt-4o-mini' },
          lastSync: persisted?.lastSync ?? null,
          autoSync: persisted?.autoSync ?? true,
          syncStatus: 'idle'
        }
      }
    }
  )
)

export default useAppStore
export { levelFromXp, nextLevelXp, LEVEL_THRESHOLDS }
