export const ALL_VIEWS = ['insights', 'diagnose', 'explain', 'recommend', 'emi', 'proposals', 'enable', 'tickets', 'pilot', 'brief', 'agents'];
export const AFF_VIEWS = ['aoverview', 'acustomers', 'adecide', 'aoffers', 'asim', 'apolicy', 'tickets', 'agents'];
// Extra screens that appear only when the Extended scope switch is on (other networks, BINs, lender routing).
export const EXT_VIEWS = ['abin', 'alend'];
export const ADMIN_VIEWS = [...new Set([...ALL_VIEWS, ...AFF_VIEWS, ...EXT_VIEWS])];
// modules: where the future Affordability suite plugs in. Users are given access per module.
export const ROLES = [
  { id: 'pm', name: 'Priya, Acceptance PM', short: 'PA', sub: 'Approves actions, raises tickets and proposals', email: 'priya@demo.example', canApprove: true, canApproveRouting: false, views: ALL_VIEWS, modules: ['acceptance'] },
  { id: 'head', name: 'Meera, Head of Acceptance', short: 'MH', sub: 'Approves routing changes, sees everything', email: 'meera@demo.example', canApprove: true, canApproveRouting: true, views: ALL_VIEWS, modules: ['acceptance', 'affordability'] },
  { id: 'en', name: 'Arjun, Merchant enablement', short: 'AM', sub: 'Sends proposals, runs enablement checklists', email: 'arjun@demo.example', canApprove: false, canApproveRouting: false, views: ['insights', 'diagnose', 'recommend', 'emi', 'proposals', 'enable', 'tickets', 'agents'], modules: ['acceptance'] },
  { id: 'dev', name: 'Dev, DevOps engineer', short: 'DE', sub: 'Works the tickets assigned to DevOps', email: 'dev@demo.example', canApprove: false, canApproveRouting: false, views: ['insights', 'diagnose', 'tickets', 'agents'], modules: ['acceptance'] },
  { id: 'aff', name: 'Kavya, Affordability Lead', short: 'KA', sub: 'Runs eligibility, limits and the offer engine', email: 'kavya@demo.example', canApprove: false, canApproveRouting: false, views: AFF_VIEWS, modules: ['affordability'], suite: 'affordability' },
  { id: 'admin', name: 'Demo admin', short: 'AD', sub: 'Every screen and right, for demonstration. Switch workspaces without signing out', email: 'admin@demo.example', canApprove: true, canApproveRouting: true, views: ADMIN_VIEWS },
];
export const roleById = id => ROLES.find(r => r.id === id) || ROLES[0];
