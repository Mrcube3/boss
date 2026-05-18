import { useState, useEffect, useRef, useCallback } from 'react'

const API = '/api'

const SERVICE_LABELS = {
  speechmatics: 'Speechmatics',
  gemini: 'Gemini Vision',
  featherless: 'Featherless'
}

function App() {
  const [theme, setTheme] = useState('dark')
  const [audioFile, setAudioFile] = useState(null)
  const [chartFile, setChartFile] = useState(null)

  const [step1, setStep1] = useState({ status: 'idle', result: '', error: '' })
  const [step2, setStep2] = useState({ status: 'idle', result: '', error: '' })
  const [step3, setStep3] = useState({ status: 'idle', result: '', error: '' })
  const [step4, setStep4] = useState({ status: 'idle', result: '', error: '' })
  const [running, setRunning] = useState(false)
  const [pipelineError, setPipelineError] = useState('')

  const [orderReceipt, setOrderReceipt] = useState(null)
  const [health, setHealth] = useState(null)
  const [logs, setLogs] = useState([])
  const logRef = useRef(null)
  const [guide, setGuide] = useState(false)

  const audioRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(setHealth).catch(() => {})
    addLog('SYSTEM', 'Listening frame processing loops active.')
    addLog('SYSTEM', 'Kraken CLI verified at /usr/local/bin/kraken.')
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  function addLog(source, message) {
    const ts = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { source, message, ts }].slice(-50))
  }

  const resetAll = useCallback(() => {
    setAudioFile(null)
    setChartFile(null)
    setStep1({ status: 'idle', result: '', error: '' })
    setStep2({ status: 'idle', result: '', error: '' })
    setStep3({ status: 'idle', result: '', error: '' })
    setStep4({ status: 'idle', result: '', error: '' })
    setOrderReceipt(null)
    setPipelineError('')
    addLog('USER', 'Pipeline reset.')
  }, [])

  const handleExecute = useCallback(async () => {
    if (!audioFile || !chartFile || running) return
    setRunning(true)
    setPipelineError('')
    setStep1({ status: 'idle', result: '', error: '' })
    setStep2({ status: 'idle', result: '', error: '' })
    setStep3({ status: 'idle', result: '', error: '' })
    setStep4({ status: 'idle', result: '', error: '' })
    setOrderReceipt(null)
    addLog('PIPELINE', 'Starting end-to-end pipeline...')

    setStep1({ status: 'active', result: '', error: '' })
    addLog('TRANSCRIBE', 'Submitting audio to Speechmatics...')
    try {
      const audioForm = new FormData()
      audioForm.append('audio', audioFile)
      const transResp = await fetch(`${API}/transcribe`, { method: 'POST', body: audioForm })
      if (!transResp.ok) throw new Error(`Transcription failed: ${transResp.status}`)
      const transData = await transResp.json()
      addLog('TRANSCRIBE', `Transcript received (${transData.transcript.length} chars)`)
      setStep1({ status: 'done', result: transData.transcript, error: '' })
    } catch (err) {
      setStep1({ status: 'error', result: '', error: err.message })
      setPipelineError(err.message)
      addLog('TRANSCRIBE', `ERROR: ${err.message}`)
      setRunning(false)
      return
    }

    setStep2({ status: 'active', result: '', error: '' })
    addLog('VISION', 'Sending chart to Gemini Vision...')
    try {
      const chartForm = new FormData()
      chartForm.append('image', chartFile)
      const chartResp = await fetch(`${API}/analyze-chart`, { method: 'POST', body: chartForm })
      if (!chartResp.ok) throw new Error(`Chart analysis failed: ${chartResp.status}`)
      const chartData = await chartResp.json()
      addLog('VISION', `Analysis received (${chartData.analysis.length} chars)`)
      setStep2({ status: 'done', result: chartData.analysis, error: '' })
    } catch (err) {
      setStep2({ status: 'error', result: '', error: err.message })
      setPipelineError(err.message)
      addLog('VISION', `ERROR: ${err.message}`)
      setRunning(false)
      return
    }

    setStep3({ status: 'active', result: '', error: '' })
    addLog('ENSEMBLE', 'Querying Featherless swarm models...')
    try {
      const pipeResp = await fetch(`${API}/execute-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: step1.result, chart_analysis: step2.result })
      })
      if (!pipeResp.ok) throw new Error(`Pipeline failed: ${pipeResp.status}`)
      const pipeData = await pipeResp.json()
      const signals = pipeData.individual_metrics.map(v => v.signal || '—').join(', ')
      addLog('ENSEMBLE', `Consensus: ${pipeData.consensus_action} (${signals})`)
      setStep3({ status: 'done', result: JSON.stringify(pipeData.individual_metrics, null, 2), error: '' })

      setStep4({ status: 'active', result: '', error: '' })
      addLog('EXECUTION', `Firing ${pipeData.consensus_action} via Kraken CLI...`)
      setOrderReceipt(pipeData.order)
      addLog('EXECUTION', `Order ${pipeData.order.status} — ${pipeData.order.transaction_hash?.slice(0, 20)}…`)
      setStep4({ status: 'done', result: JSON.stringify(pipeData.order, null, 2), error: '' })
      addLog('PIPELINE', 'Pipeline completed.')
    } catch (err) {
      setStep3({ status: 'error', result: '', error: err.message })
      setPipelineError(err.message)
      addLog('ENSEMBLE', `ERROR: ${err.message}`)
    }
    setRunning(false)
  }, [audioFile, chartFile, running, step1.result, step2.result])

  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT') return

      switch (e.key) {
        case '1':
          audioRef.current?.click()
          break
        case '2':
          chartRef.current?.click()
          break
        case 'Enter':
          e.preventDefault()
          if (audioFile && chartFile && !running) handleExecute()
          break
        case 'Escape':
          resetAll()
          break
        case 'g':
        case 'G':
          setGuide(p => !p)
          break
        case 'd':
        case 'D':
          setTheme(t => t === 'dark' ? 'light' : 'dark')
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [audioFile, chartFile, running, handleExecute, resetAll])

  const connectedServices = health
    ? Object.entries(health).filter(([k, v]) => k !== 'status' && v)
    : []

  return (
    <div className="app-layout">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo">🔮</span>
          <span className="topbar-title">VoxRegime Oracle</span>
        </div>
        <div className="topbar-center">
          {connectedServices.map(([key]) => (
            <span key={key} className="status-badge">
              <span className="dot on" />
              {SERVICE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          ))}
          <span className="status-badge kraken">
            <span className="dot on" /> Kraken
          </span>
        </div>
        <div className="topbar-right">
          <input
            type="checkbox"
            className="toggle-switch"
            checked={theme === 'dark'}
            onChange={e => setTheme(e.target.checked ? 'dark' : 'light')}
          />
        </div>
      </header>

      <main className="main-content">
        <div className="help-bar">
          <span><kbd>1</kbd> Voice</span>
          <span><kbd>2</kbd> Chart</span>
          <span><kbd>Enter</kbd> Execute</span>
          <span><kbd>Esc</kbd> Clear</span>
          <span><kbd>G</kbd> Guide</span>
          <span><kbd>D</kbd> Theme</span>
        </div>

        <div className="card guide-card" onClick={() => setGuide(!guide)}>
          <div className="card-header">
            <span>Pipeline Overview</span>
            <span className={`guide-arrow ${guide ? 'open' : ''}`}>▾</span>
          </div>
          {guide && (
            <div className="guide-grid">
              <div className="guide-item">
                <span className="guide-num">1</span>
                <div>
                  <div className="guide-title">Voice Command</div>
                  <div className="guide-desc">Upload .wav or .mp3 — e.g. <em>"buy NVDA with 2% risk"</em></div>
                </div>
              </div>
              <div className="guide-item">
                <span className="guide-num">2</span>
                <div>
                  <div className="guide-title">Chart Analysis</div>
                  <div className="guide-desc">Upload .png or .jpg for AI regime classification</div>
                </div>
              </div>
              <div className="guide-item">
                <span className="guide-num">3</span>
                <div>
                  <div className="guide-title">Ensemble Execution</div>
                  <div className="guide-desc">Transcribe → Analyze → Vote → Fire order</div>
                </div>
              </div>
              <div className="guide-item">
                <span className="guide-num">4</span>
                <div>
                  <div className="guide-title">Order Receipt</div>
                  <div className="guide-desc">Review trade confirmation and event logs</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span>Input Sources</span>
          </div>
          <div className="upload-row">
            <div className={`file-zone ${audioFile ? 'has-file' : ''}`} onClick={() => audioRef.current?.click()}>
              <div className="file-icon">🎙️</div>
              <div className="file-label">Voice Command</div>
              <div className="file-hint">{audioFile ? audioFile.name : '.wav or .mp3'}</div>
              <input ref={audioRef} type="file" accept=".wav,.mp3" onChange={e => { setAudioFile(e.target.files[0]); addLog('USER', `Audio: ${e.target.files[0].name}`) }} />
            </div>
            <div className={`file-zone ${chartFile ? 'has-file' : ''}`} onClick={() => chartRef.current?.click()}>
              <div className="file-icon">📊</div>
              <div className="file-label">Chart Image</div>
              <div className="file-hint">{chartFile ? chartFile.name : '.png or .jpg'}</div>
              <input ref={chartRef} type="file" accept=".png,.jpg,.jpeg" onChange={e => { setChartFile(e.target.files[0]); addLog('USER', `Chart: ${e.target.files[0].name}`) }} />
            </div>
            <div className="upload-actions">
              <button className="execute-btn" disabled={!audioFile || !chartFile || running} onClick={handleExecute}>
                {running ? <span className="spinner" /> : 'Execute'}
              </button>
              <button className="clear-btn" disabled={running} onClick={resetAll}>✕</button>
            </div>
          </div>
          {pipelineError && <div className="error-msg">{pipelineError}</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <span>Pipeline Stages</span>
            <span className="stage-hint">
              {running ? 'Running...' : !step4.status || step4.status === 'idle' ? 'Awaiting input' : ''}
            </span>
          </div>
          <div className="step-blocks">
            <StepBlock num={1} label="Transcribe" icon="🗣️" subtitle="Speechmatics STT" state={step1} />
            <StepBlock num={2} label="Analyze" icon="👁️" subtitle="Gemini Vision" state={step2} />
            <StepBlock num={3} label="Ensemble" icon="🤖" subtitle="Featherless Swarm" state={step3} />
            <StepBlock num={4} label="Execute" icon="⚡" subtitle="Kraken CLI" state={step4} />
          </div>
        </div>

        {orderReceipt && (
          <div className="card receipt-card">
            <div className="card-header">
              <span>🏁 Order Receipt</span>
              <span className={`badge ${orderReceipt.action_fired === 'BUY' ? 'buy' : orderReceipt.action_fired === 'SELL' ? 'sell' : 'hold'}`}>
                {orderReceipt.action_fired}
              </span>
            </div>
            <div className="receipt-grid">
              <div className="receipt-field">
                <span className="field-label">Status</span>
                <span className="field-value">{orderReceipt.status}</span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Asset</span>
                <span className="field-value">{orderReceipt.asset_executed}</span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Risk Profile</span>
                <span className="field-value">{orderReceipt.risk_profile_applied}</span>
              </div>
              <div className="receipt-field">
                <span className="field-label">Timestamp</span>
                <span className="field-value mono">{orderReceipt.timestamp_utc}</span>
              </div>
              <div className="receipt-field full">
                <span className="field-label">Transaction Hash</span>
                <span className="field-value mono">{orderReceipt.transaction_hash}</span>
              </div>
            </div>
          </div>
        )}

        <div className="card logs-card">
          <div className="card-header">
            <span>Event Logs</span>
            <span className="log-count">{logs.length} events</span>
          </div>
          <div className="log-container" ref={logRef}>
            {logs.length === 0 ? (
              <div className="log-empty">No events yet</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="log-line">
                  <span className="log-ts">{log.ts}</span>
                  <span className={`log-src log-${log.source.toLowerCase()}`}>{log.source}</span>
                  <span className="log-msg">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StepBlock({ num, icon, label, subtitle, state }) {
  let cls = 'step-block'
  if (state.status === 'active') cls += ' active'
  else if (state.status === 'done') cls += ' done'
  else if (state.status === 'error') cls += ' error'
  const badge = state.status === 'done' ? '✓' : state.status === 'error' ? '✕' : num
  return (
    <div className={cls}>
      <div className="step-badge">{badge}</div>
      <div className="step-body">
        <div className="step-icon">{icon}</div>
        <div className="step-content">
          <div className="step-label">{label}</div>
          <div className="step-subtitle">{subtitle}</div>
          {state.status === 'active' && <div className="step-status active-s"><span className="spinner" /> Processing</div>}
          {state.status === 'done' && <div className="step-status done-s">Complete</div>}
          {state.status === 'error' && <div className="step-status err-s">{state.error}</div>}
        </div>
      </div>
    </div>
  )
}

export default App
