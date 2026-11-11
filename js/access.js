// Who may see the page. RLS on `people` hides every row from someone not on the list, so a member reads at least
// their own row and anyone else reads none: zero rows means «no access», never an empty list.

const normalise = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

// 'member' | 'no-access'
export function accessState(peopleRows, email) {
  const own = normalise(email);
  if (!own || !Array.isArray(peopleRows)) return "no-access";
  return peopleRows.some((row) => row && normalise(row.email) === own) ? "member" : "no-access";
}
