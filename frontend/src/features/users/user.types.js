/**
 * @typedef {Object} UserListItem
 * @property {number} sr_no
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {number|null} insert_by
 * @property {string} insert_by_val
 * @property {string|null} insert_datetime
 * @property {number|null} update_by
 * @property {string} update_by_val
 * @property {string|null} update_datetime
 */

/**
 * @typedef {Object} GetUsersRequest
 * @property {string} [name]
 * @property {string} [email]
 * @property {number} [page_size]
 * @property {number} [current_page]
 */

/**
 * @typedef {Object} GetUsersResponse
 * @property {string} message
 * @property {number} current_page
 * @property {number} total_count
 * @property {boolean} has_more
 * @property {number} page_size
 * @property {number} total_page
 * @property {UserListItem[]} data
 */

/**
 * @typedef {Object} CreateUserRequest
 * @property {string} name
 * @property {string} email
 * @property {string} password
 */

/**
 * @typedef {Object} UpdateUserRequest
 * @property {number} id
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [password]
 */

/**
 * @typedef {Object} UserPagination
 * @property {number} current_page
 * @property {number} total_count
 * @property {boolean} has_more
 * @property {number} page_size
 * @property {number} total_page
 */

/**
 * @typedef {Object} UserFilters
 * @property {string} name
 * @property {string} email
 */

export {};
