"""Independent checker: recomputes from dataset.json in plain Python and asserts the four planted patterns."""
import json, sys
d = json.load(open('src/data/dataset.json'))
A, I, IS, DC, M, T = d['acquirers'], d['instruments'], d['issuers'], d['declines'], d['merchants'], d['tx']
ok = lambda r: r[6] == 0
def rate(rows): return 100 * sum(ok(r) for r in rows) / len(rows) if rows else float('nan')
fails = []
def check(name, cond, detail):
    print(('PASS ' if cond else 'FAIL ') + name + ' :: ' + detail)
    if not cond: fails.append(name)
print('transactions', len(T), 'merchants', len(M))
check('size', 4500 <= len(T) <= 5500 and len(M) == 40, f'{len(T)} tx, {len(M)} merchants')
# 1: Acquirer C RuPay gap
c = [r for r in T if r[2] == 2 and r[3] <= 1]; p = [r for r in T if r[2] != 2 and r[3] <= 1]
gap = rate(p) - rate(c)
check('pattern1 RuPay gap at Acquirer C', 4.5 <= gap <= 8.5, f'C {rate(c):.1f}% vs peers {rate(p):.1f}% gap {gap:.1f} (n={len(c)})')
def tshare(rows):
    f = [r for r in rows if not ok(r)]; return 100 * sum(r[6] == 1 for r in f) / len(f)
check('pattern1 timeouts dominate at C', tshare(c) > tshare(p) + 10, f'timeout share of declines C {tshare(c):.0f}% vs peers {tshare(p):.0f}%')
# 2: credit on UPI success good, share low in electronics/travel
cu = [r for r in T if r[3] == 5]
check('pattern2 success good', rate(cu) >= 91, f'UPI+RuPay credit success {rate(cu):.1f}%')
cat = lambda r: M[r[1]]['category']
hi = [r for r in T if cat(r) in ('Electronics', 'Travel')]; lo = [r for r in T if cat(r) not in ('Electronics', 'Travel')]
sh = lambda rows, k: 100 * sum(r[3] == k for r in rows) / len(rows)
check('pattern2 low share in electronics/travel', sh(hi, 5) < 0.5 * sh(lo, 5), f'share {sh(hi,5):.1f}% vs {sh(lo,5):.1f}% elsewhere')
# 3: issuer spike
def idr(i):
    rows = [r for r in T if r[4] == i]; return 100 * sum(r[6] == 2 for r in rows) / len(rows)
others = sum(idr(i) for i in range(len(IS)) if i != 6) / (len(IS) - 1)
check('pattern3 issuer spike', idr(6) > 2 * others, f'Issuer 07 issuer-decline {idr(6):.1f}% vs avg others {others:.1f}%')
# 4: credit line at high tickets
big = [r for r in T if r[5] >= 25000]; small = [r for r in T if r[5] < 25000]
check('pattern4 credit line high-ticket share', sh(big, 6) < 0.25 * sh(small, 6), f'share {sh(big,6):.2f}% (>=25k) vs {sh(small,6):.2f}% (<25k)')
# enable flags
check('enable flags', all(len(m['enabled']) == 7 for m in M) and any(not m['enabled'][5] for m in M), 'flags present')
sys.exit(1 if fails else 0)
