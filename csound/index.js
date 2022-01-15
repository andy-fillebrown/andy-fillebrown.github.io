
const csdText =
`<CsoundSynthesizer>
<CsOptions>

-n
-d
-m0d

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
editor.setValue(csdText);
//editor.moveCursorTo(0, 0)
//editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/csound_orchestra");
//editor.setValue(csdText, 1) // The 1 moves the cursor to the end.
editor.setFontSize(16);
editor.setAutoScrollEditorIntoView(false)


function openTab(e, tabName) {
  // Hide all tab-body elements.
  var tabBodyElements =
    document.getElementsByClassName("tab-body")
  for (var i = 0; i < tabBodyElements.length; i++) {
    tabBodyElements[i].style.display = "none"
  }

  // Get all elements with class="tab" and remove the
  // class "active".
  var tabs = document.getElementsByClassName("tab")
  for (i = 0; i < tabs.length; i++) {
    tabs[i].className =
      tabs[i].className.replace(" active", "")
  }

  // Show the current tab and add the class "active".
  document.getElementById(tabName).style.display =
    "block"
  e.currentTarget.className += " active"
}


/*
let viewport = window.visualViewport
const viewportHandler = () => {
  let body = document.body
  body.style.width = '' + viewport.width + 'px'
  body.style.height = '' + viewport.height + 'px'
}
viewport.addEventListener('scroll', viewportHandler)
viewport.addEventListener('resize', viewportHandler)
*/


document.addEventListener("DOMContentLoaded", () => {
  const previousCsdText = localStorage.getItem("csdText")
  if (previousCsdText != null) {
    editor.setValue(previousCsdText)
    //editor.moveCursorTo(0, 0)
  }
})

const updateEditorHeight = () => {
  //const scrollX = window.scrollX
  //const scrollY = window.scrollY
  
  document.getElementById("Editor-ACE").style.height =
    ""
    + (editor.getSession().getScreenLength()
        * editor.renderer.lineHeight
        + editor.renderer.scrollBar.getWidth()
      )
    + "px"
  
  editor.resize()
  //window.scrollTo(scrollX, scrollY)
}

const onEditorContentsChanged = () => {
  localStorage.setItem("csdText", editor.getValue())
  updateEditorHeight()
  
}

document.addEventListener("DOMContentLoaded", updateEditorHeight)
editor.getSession().on("change", onEditorContentsChanged)
let initEditorHeightTimer = setInterval(() => {
  if (editor.renderer.lineHeight > 0) {
    clearInterval(initEditorHeightTimer)
    updateEditorHeight()
  }
}, 100)


/*
window.addEventListener("beforeunload", (e) => {
  e.preventDefault()
  e.returnValue = ""
})
*/

