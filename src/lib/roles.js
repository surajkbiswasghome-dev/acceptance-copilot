export const ALL_VIEWS = ['insights', 'diagnose', 'explain', 'recommend', 'proposals', 'enable', 'tickets', 'pilot', 'brief', 'agents'];
// modules: where the future Affordability suite plugs in. Users are given access per module.
export const ROLES = [
  { id: 'pm', name: 'Priya, Acceptance PM', short: 'PA', sub: 'Approves actions, raises tickets and proposals', email: 'priya@demo.example', canApprove: true, canApproveRouting: false, views: ALL_VIEWS, modules: ['acceptance'] },
  { id: 'head', name: 'Meera, Head of Acceptance', short: 'MH', sub: 'Approves routing changes, sees everything', email: 'meera@demo.example', canApprove: true, canApproveRouting: true, views: ALL_VIEWS, modules: ['acceptance', 'affordability'] },
  { id: 'en', name: 'Arjun, Merchant enablement', short: 'AM', sub: 'Sends proposals, runs enablement checklists', email: 'arjun@demo.example', canApprove: false, canApproveRouting: false, views: ['insights', 'diagnose', 'recommend', 'proposals', 'enable', 'tickets', 'agents'], modules: ['acceptance'] },
  { id: 'dev', name: 'Dev, DevOps engineer', short: 'DE', sub: 'Works the tickets assigned to DevOps', email: 'dev@demo.example', canApprove: false, canApproveRouting: false, views: ['insights', 'diagnose', 'tickets', 'agents'], modules: ['acceptance'] }
];
export const roleById = id => ROLES.find(r => r.id === id) || ROLES[0];
