//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Viewport resize handling

let viewport = window.visualViewport

const onViewportResized = () => {
    document.getElementById("Body").style = "height: " + viewport.height + "px"
    editor.resize()
    editor.renderer.scrollToRow(Math.max(editor.getCursorPosition().row - 27, 0))
}
viewport.addEventListener("resize", onViewportResized)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ACE editor

const csdText =
`<CsoundSynthesizer>
<CsOptions>

-nd

</CsOptions>
<CsInstruments>

nchnls = 2
0dbfs = 1

instr 1
   a1 oscili 0.1, 440
   outs a1, a1
endin

</CsInstruments>
<CsScore>

i1 0 10

</CsScore>
</CsoundSynthesizer>
`

const editor = ace.edit("Editor-ACE"); // "Editor-ACE" is DOM element's id.
editor.session.setOptions({
  mode: "ace/mode/csound_orchestra",
  tabSize: 3,
  useSoftTabs: true
})
editor.setFontSize(16);
editor.setValue(csdText);
editor.moveCursorTo(0, 0)
editor.session.setUndoManager(new ace.UndoManager())

document.addEventListener("DOMContentLoaded", () => {
  const previousCsdText = localStorage.getItem("csdText")
  if (previousCsdText != null) {
    editor.setValue(previousCsdText)
    editor.moveCursorTo(0, 0)
  }
})

editor.getSession().on("change", () => {
  localStorage.setItem("csdText", editor.getValue())
})

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Csound

const maxDurationInMinutes = 1

let csound = null
let offlineAudioContext = null
let offlineAudioBuffer = null
let audioContext = null
let source = null
let duration = 0
let isCompiled = false
let isPlaying = false
let playbackTimer = null

const wait = ms => new Promise(res => setTimeout(res, ms));

const csoundInit = async () => {
  console.debug("Initializing Csound ...")

  isPlaying = true
  isCompiled = false

  if (csound != null) {
    csound.destroy()
  }
  csound = null

  console.debug("Creating offline audio context ...")
  offlineAudioContext = new OfflineAudioContext(2, 48000 * maxDurationInMinutes * 60, 48000)
  
  // NB: I tried moving this to csoundPerform() but it doesn't work there in iOS Safari.
  console.debug("Creating playback audio context ...")
  audioContext = new AudioContext({ sampleRate: 48000 })
  audioContext.createGain() // This wakes the audio context up in iOS Safari.

  console.debug("Creating Csound object ...")
  csound = await window.Csound({
    audioContext: offlineAudioContext,
    useWorker: false,
    useSAB: false,
    useSPN: true
  })

  console.debug("Initializing Csound - done")
}

const csoundCompile = async () => {
  await csound.setOption('--iobufsamps=16384')
  await csound.setOption('--sample-rate=48000')
  const result = await csound.compileCsdText(editor.getSession().getValue())
  console.log(`Csound compile returned ${result}`)
  if (result == 0) {
    isCompiled = true
  }
  else {
    isPlaying = false
    isCompiled = false
    setDomElementVisibility("Button-Stop", false)
    setDomElementVisibility("Button-Play", true)
  }
}

const csoundPerform = async () => {
  if (isCompiled) {
    console.debug(`Performing Csound score ...`)
    csound.start()
    offlineAudioBuffer = await offlineAudioContext.startRendering()
    console.debug(`Performing Csound score - done`)
  }
}

const csoundPlayOutput = async () => {
  if (!isPlaying) {
    return
  }
  console.debug(`Playing Csound output ...`)
  source = audioContext.createBufferSource()
  source.buffer = offlineAudioBuffer
  source.connect(audioContext.destination)
  source.start()
  duration = Number((await csound.getCurrentTimeSamples()) / BigInt(48000)) * 1000
  playbackTimer = setTimeout(() => {
    csoundStop()
  }, duration)
  csound.destroy()
}

const csoundStop = () => {
  setDomElementVisibility("Button-Stop", false)
  setDomElementVisibility("Button-Play", true)

  isPlaying = false

  if (playbackTimer != null) {
    clearTimeout(playbackTimer)
  }

  if (source != null) {
    source.stop()
  }

  if (csound != null) {
    csound.stop()
  }

  console.debug(`Playing Csound output - done`)
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Button handling

const setDomElementVisibility = (domElementId, visible) => {
  const domElement = document.getElementById(domElementId)
  if (visible) {
    domElement.style.display = ""
  }
  else {
    domElement.style.display = "none"
  }
}

const setEditorVisibility = (visible) => setDomElementVisibility("Editor", visible)
const showEditor = () => setEditorVisibility(true)
const hideEditor = () => setEditorVisibility(false)
showEditor()

const setConsoleVisibility = (visible) => setDomElementVisibility("Console", visible)
const showConsole = () => setConsoleVisibility(true)
const hideConsole = () => setConsoleVisibility(false)
hideConsole()

const buttonReset = document.getElementById("Button-Reset")
const buttonUndo = document.getElementById("Button-Undo")
const buttonRedo = document.getElementById("Button-Redo")
const buttonEditor = document.getElementById("Button-Editor")
const buttonConsole = document.getElementById("Button-Console")
const buttonPlay = document.getElementById("Button-Play")
const buttonStop = document.getElementById("Button-Stop")
setDomElementVisibility("Button-Stop", false)

buttonReset.onclick = buttonReset.ondblclick = () => {
  editor.setValue(csdText)
  editor.moveCursorTo(0, 0)
}

buttonUndo.onclick = buttonUndo.ondblclick = () => {
  editor.session.getUndoManager().undo()
}

buttonRedo.onclick = buttonRedo.ondblclick = () => {
  editor.session.getUndoManager().redo()
}

buttonEditor.onclick = buttonEditor.ondblclick = async () => {
  console.debug("Editor button clicked.")
  showEditor()
  hideConsole()
}

buttonConsole.onclick = buttonConsole.ondblclick = async () => {
  console.debug("Console button clicked.")
  showConsole()
  hideEditor()
}

buttonPlay.onclick = buttonPlay.ondblclick = async () => {
  setDomElementVisibility("Button-Play", false)
  setDomElementVisibility("Button-Stop", true)
  console.log("Play button clicked.")
  consoleOutput.innerHTML = ""
  await csoundInit()
  await csoundCompile()
  await csoundPerform()
  await csoundPlayOutput()
}

buttonStop.onclick = buttonStop.ondblclick = csoundStop

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Echo Javascript console to HTML element

const consoleOutput = document.getElementById("Console-Output")
ConsoleLogHTML.connect(consoleOutput, {}, false, true, true);

let previousConsoleOutputHeight = 0
let observer = new MutationObserver((mutationsList, observer) => {
  const consoleOutputHeight = consoleOutput.offsetHeight
  if (previousConsoleOutputHeight != consoleOutputHeight) {
    previousConsoleOutputHeight = consoleOutputHeight
    document.getElementById("Console").scrollTop = consoleOutputHeight
  }
})
observer.observe(consoleOutput, { characterData: false, childList: true, attributes: false })
