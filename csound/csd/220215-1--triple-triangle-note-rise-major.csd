<CsoundSynthesizer>
<CsOptions>
-nd
</CsOptions>
<CsInstruments>
nchnls=2
0dbfs=1
instr 1
   p3=5
   iaNoteStart=60
   iaNoteEnd=72
   ibNoteStart=64
   ibNoteEnd=79
   icNoteStart=67
   icNoteEnd=88
   iVolume=0.5
   iA=.25
   iD=.25
   iS=.75
   iR=15
   aa=0
   ab=0
   ac=0
   aOut=0
   xtratim(iR)
   iPitchBendDuration=iA+iD
   kaNote=linseg:k(iaNoteStart, iPitchBendDuration, iaNoteEnd)
   kaCps=cpsmidinn:k(kaNote)
   aa+=vco2(iVolume,kaCps,12);triangle
   aOut+=aa
   kbNote=linseg:k(ibNoteStart, iPitchBendDuration, ibNoteEnd)
   kbCps=cpsmidinn:k(kbNote)
   ab+=vco2(iVolume,kbCps,12);triangle
   aOut+=ab
   kcNote=linseg:k(icNoteStart, iPitchBendDuration, icNoteEnd)
   kcCps=cpsmidinn:k(kcNote)
   ac+=vco2(iVolume,kcCps,12);triangle
   aOut+=ac
   aOut*=xadsr:a(iA,iD,iS,iR)
   outall(aOut)
endin
</CsInstruments>
<CsScore>
         
i1 .0 .5
</CsScore>
</CsoundSynthesizer>
