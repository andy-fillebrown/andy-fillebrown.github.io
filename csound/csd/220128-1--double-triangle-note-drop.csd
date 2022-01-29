<CsoundSynthesizer>
<CsOptions>
-nd
</CsOptions>
<CsInstruments>
nchnls=2
0dbfs=1
instr 1
   iVolume=0.5
   iaNoteStart=72
   iaNoteEnd=36
   ibNoteStart=84
   ibNoteEnd=48
   iA=.1
   iD=.1
   iS=.75
   iR=20
   aa=0
   ab=0
   aOut=0
   xtratim(iR)
   iDuration=p3+iR
   kaNote=linseg:k(iaNoteStart, iDuration, iaNoteEnd)
   kaCps=cpsmidinn:k(kaNote)
   aa+=vco2(iVolume,kaCps,12);triangle
   aa*=xadsr:a(iA,iD,iS,iR)
   aOut+=aa
   kbNote=linseg:k(ibNoteStart, iDuration, ibNoteEnd)
   kbCps=cpsmidinn:k(kbNote)
   ab+=vco2(iVolume,kbCps,12);triangle
   ab*=xadsr:a(iA,iD,iS,iR)
   aOut+=ab
   outs(aOut,aOut)
endin
</CsInstruments>
<CsScore>
i1 0 1
</CsScore>
</CsoundSynthesizer>
