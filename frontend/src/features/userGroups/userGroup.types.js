/**
 * @typedef {Object} UserGroupListItem
 * @property {number} sr_no
 * @property {string} id
 * @property {string} group_name
 * @property {boolean} sys_admin
 * @property {number} status
 * @property {number|null} insert_by
 * @property {string} insert_by_val
 * @property {string|null} insert_datetime
 * @property {number|null} update_by
 * @property {string} update_by_val
 * @property {string|null} update_datetime
 */

/**
 * @typedef {Object} GetUserGroupsRequest
 * @property {string} [group_name]
 * @property {string|number} [status]
 * @property {number} [page_size]
 * @property {number} [current_page]
 */

/**
 * @typedef {Object} GetUserGroupsResponse
 * @property {string} message
 * @property {number} current_page
 * @property {number} total_count
 * @property {boolean} has_more
 * @property {number} page_size
 * @property {number} total_page
 * @property {UserGroupListItem[]} data
 */

/**
 * @typedef {Object} CreateUserGroupRequest
 * @property {string} group_name
 * @property {boolean} sys_admin
 * @property {number} status
 */

/**
 * @typedef {Object} UpdateUserGroupRequest
 * @property {string} id
 * @property {string} [group_name]
 * @property {boolean} [sys_admin]
 * @property {number} [status]
 */

export {};
