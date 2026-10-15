# Extension verification — sampling, crash forensics, symbolization, de-virtualization

Covers the second hardware-layer pass: `references/hardware-sampling-and-crash.md`,
`scripts/trace_addr2sym.py`, `scripts/vm_handler_slice.py`, and the source-reading
corrections to the flattening recipes. Strength labels as this directory's README defines
them.

Reference environment: Linux container host, Python 3.13, cross `gcc 16.2.0` targeting
`aarch64-linux-gnu` (the toolchain that makes the symbolizer's "real ELF" half testable).
Network access was used once, read-only, to fetch the two public obfuscator implementations
the calibration cites (below). No Android device, no coresight/SPE/BRBE hardware.

**Headline: the address→symbol loop is measured against a real cross-compiled library, the
de-virtualization slicer is measured on synthetic interpreter traces, and the SPE/BRBE
producer side remains documented-and-gated. The flattening-recipe corrections are read from
public source, and that source is named.**

---

## 1. `trace_addr2sym.py` against a real library — observed

```
$ gcc -shared -fPIC -O2 -o libtlib.so tlib.c      # cross gcc -> aarch64 ELF64
$ readelf --syms -W libtlib.so
... 00000000000005e0  132 FUNC GLOBAL DEFAULT 9 encrypt_block
... 0000000000000664    4 FUNC GLOBAL DEFAULT 9 decrypt_block
$ python skills/apk-reverse/scripts/trace_addr2sym.py --elf libtlib.so --offs 0x610
  0x610              -> encrypt_block+0x30  [vaddr 0x610 file 0x610 .text+0x130]
```

The resolution agrees with `readelf` exactly (0x610 − 0x5e0 = 0x30, inside the sized symbol);
a point outside any function falls to the nearest-below symbol with its section shown
(`0x700 -> _fini+0x98 [.eh_frame+0x40]`), which is GNU-addr2line-shaped behaviour and is
pinned by unit test together with the PT_LOAD `vaddr≠offset` conversion on a hand-built
minimal ELF. That minimal-ELF fixture also covers the stripped-library fallback
(section+offset, no symbols).

## 2. `vm_handler_slice.py` on the calibrated shape — observed

A synthetic interpreter trace in the shape the public IR virtualizer emits
(dispatcher D, handler blocks, one const-materialization segment, an unclosed tail):

```
$ python skills/apk-reverse/scripts/vm_handler_slice.py --log vm.log --opcode-map map.json
dispatcher: libvm.so+0x1000  (41.7% of 24 blocks, 10 hits)
segments: 10 total, 7 unique, avg len 2.00   [last segment UNCLOSED: exit path or truncated window]
opcode trajectory (first 20): OP_LOAD OP_LOAD OP_STORE OP_BR OP_LOAD OP_LOAD OP_BR OP_CALL OP_LOAD OP_RET
```

What the output pins, and why each part is the part a de-virtualization needs: the
**dispatcher share** (with the diagnostic that separates a real dispatch loop from a spin
loop), the **segment table** (one row per handler chain, first block = handler entry =
the `--opcode-map` key), the **trajectory** (the guest program, one signature per executed
guest opcode), the **OP_CALL materialization segment** appearing as its own signature (the
virtualizer's const dispatch — the second observation point the calibration names), and the
**UNCLOSED tail** flagged rather than silently dropped. The auto-detection rule is
top-of-histogram **plus predecessor diversity** (≥3 distinct predecessors), not a naive
count margin: the first implementation used a 4x margin and refused this very fixture —
in a stack-shaped VM the hottest handler executes on every guest instruction, exactly as
often as the dispatcher. That refusal-to-accept is the load-bearing part of the auto rule.

## 3. The flattening-recipe corrections — observed source, inferred runtime

Fetched read-only from the public implementations the user supplied
(github.com/dpkg123/ollvm-aosp-toolchain: branch `ollvm-r614150-clang23-rebase+omp`
[Hikari family] and `ollvm-r614150-clang23+omp` [Pluto family]; commits 63fec41f and
9b7cf75e for the IR virtualizer; 2026-10):

- **Hikari `Flattening.cpp`**: `switchVar` is an entry-block **alloca** written through a
  `switchVarAddr` double pointer (indirect store per transition); case values are
  `scramble32`-permuted; EH-bearing functions are skipped.
- **Pluto `Flattening.cpp`**: two allocas (`switchVar`, `switchXor`) with a **rolling XOR**
  (`enc^=delta; key^=delta; cond=enc^key` per dispatch); case values fully random; the true
  case exists only in the `switchCond` register for one instruction; EH/`callbr`/`indirectbr`
  functions skipped.
- **Hikari `AntiDebugging.cpp`**: on Darwin/AArch64 it injects **inline-assembly raw `svc`**
  with a randomized register-setup order and a **randomized svc immediate**; elsewhere it
  links precompiled anti-debug IR. Consequence recorded in the reference: byte signatures
  cannot survive the randomization; semantic site-location (`svc_scan.py`) and hardware
  observation do not care.
- **The IR virtualizer**: `vm_exec(code, size, vm_args, num)` stubs, boxed-argument array,
  11 one-byte opcodes + 19 arithmetic sub-ops, const/call materialization dispatch,
  switch-to-if lowering.

These corrected `hardware-watchpoints.md`'s state-variable recipe (the old text assumed a
global and a readable value — wrong for both families as shipped) and added the
family-difference table to `ete-diff-tracing.md` §5. The fetches live under
`tools/_work/refs/` (git-ignored); **runtime behaviour of these passes is `inferred` from
source, never executed here.**

## 4. What this pass deliberately did not do

- No SPE capture, no BRBE record read, no `perf -j any` on any device: those routes ship as
  documented-and-gated, and the reference's §5 failure modes say exactly how each gate
  fails silently.
- No xvmp-hardened binary was compiled or traced: the slicer's calibration is source-read,
  and its first run against a real sample is a measurement, not a confirmation.
- The `--opcode-map` a real target needs is a manual labelling task over the segment table;
  this pass generated the fixture's map by hand, which is exactly the workflow the script
  documents.
