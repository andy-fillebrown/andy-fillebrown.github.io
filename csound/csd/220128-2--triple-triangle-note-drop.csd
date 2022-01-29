<CsoundSynthesizer>
<CsOptions>
-nd
</CsOptions>
<CsInstruments>
nchnls=2
0dbfs=1
instr 1
   iVolume=0.5
   iaNoteStart=84
   iaNoteEnd=36
   ibNoteStart=79
   ibNoteEnd=36
   icNoteStart=72
   icNoteEnd=36
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
i1 0 0.5
</CsScore>
</CsoundSynthesizer>
