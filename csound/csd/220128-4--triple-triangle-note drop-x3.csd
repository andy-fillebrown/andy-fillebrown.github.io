<CsoundSynthesizer>
<CsOptions>
-nd
</CsOptions>
<CsInstruments>
nchnls=2
0dbfs=1
instr 1
   p3=5
   iPitchShiftMultiplier=p4
   iPitchShift=-5*iPitchShiftMultiplier
   iaNoteStart=84+iPitchShift
   iaNoteEnd=36+iPitchShift
   ibNoteStart=79+iPitchShift
   ibNoteEnd=36+iPitchShift
   icNoteStart=72+iPitchShift
   icNoteEnd=36+iPitchShift
   iVolume=0.5
   iA=.1
   iD=.1
   iS=.75
   iR=15
   aa=0
   ab=0
   ac=0
   aOut=0
   xtratim(iR)
   iDuration=p3+iR
   kaNote=linseg:k(iaNoteStart, iDuration, iaNoteEnd)
   kaCps=cpsmidinn:k(kaNote)
   aa+=vco2(iVolume,kaCps,12);triangle
   aOut+=aa
   kbNote=linseg:k(ibNoteStart, iDuration, ibNoteEnd)
   kbCps=cpsmidinn:k(kbNote)
   ab+=vco2(iVolume,kbCps,12);triangle
   aOut+=ab
   kcNote=linseg:k(icNoteStart, iDuration, icNoteEnd)
   kcCps=cpsmidinn:k(kcNote)
   ac+=vco2(iVolume,kcCps,12);triangle
   aOut+=ac
   aOut*=xadsr:a(iA,iD,iS,iR)
   outs(aOut,aOut)
endin
</CsInstruments>
<CsScore>
         ;p4 = pitch shift multiplier
i1 .0 .5 .0
i1 .1 .5 .333
i1 .2 .5 .667
i1 .3 .5 1
</CsScore>
</CsoundSynthesizer>
