
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
