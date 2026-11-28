/**
 * Standard pagination helper for JalSetu list endpoints.
 * Handles page & limit query params and backward-compatibility when unpaginated.
 */

function parsePagination(query, defaultLimit = 20) {
  const hasPage = query && query.page !== undefined && query.page !== '';
  const hasLimit = query && query.limit !== undefined && query.limit !== '';
  const isPaginated = Boolean(hasPage || hasLimit);

  let page = 1;
  if (hasPage) {
    const parsedPage = parseInt(query.page, 10);
    if (!isNaN(parsedPage) && parsedPage >= 1) {
      page = parsedPage;
    }
  }

  let limit = defaultLimit;
  if (hasLimit) {
    const parsedLimit = parseInt(query.limit, 10);
    if (!isNaN(parsedLimit) && parsedLimit >= 1) {
      limit = Math.min(parsedLimit, 100);
    }
  }

  const skip = (page - 1) * limit;

  return {
    isPaginated,
    page,
    limit,
    skip,
  };
}

module.exports = {
  parsePagination,
};
