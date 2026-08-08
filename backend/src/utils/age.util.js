// ---------------------------------------------------------
// utils/age.util.js
// Small, pure helpers for age-gating (DPDP Act 2023 requires
// verifiable parental consent before processing a minor's
// data for certain actions — payments, AI mentor usage, etc).
//
// Kept dependency-free and synchronous so it can be reused in
// both the API layer (toSafeUser) and middleware.
// ---------------------------------------------------------

const ADULT_AGE = 18;

/**
 * Returns age in whole years for a given DOB, or null if DOB is missing.
 * @param {Date|string|null|undefined} dateOfBirth
 * @returns {number|null}
 */
function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();

  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

/**
 * True if the user is under 18. Returns false (not minor) when DOB
 * is unknown — callers that need to force DOB collection should
 * check `dateOfBirth == null` separately rather than relying on this.
 * @param {Date|string|null|undefined} dateOfBirth
 * @returns {boolean}
 */
function isMinor(dateOfBirth) {
  const age = getAge(dateOfBirth);
  return age !== null && age < ADULT_AGE;
}

module.exports = { getAge, isMinor, ADULT_AGE };
