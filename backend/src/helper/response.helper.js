const success = (res, data = null, message = 'Success', status = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

const paginatedList = (res, { message = '', summary, data }) => {
  return res.status(200).json({
    message,
    current_page: summary?.current_page ?? 1,
    total_count: summary?.total_count ?? 0,
    has_more: Boolean(summary?.has_more),
    page_size: summary?.page_size ?? 0,
    total_page: summary?.total_page ?? 0,
    data: data || [],
  });
};

const error = (res, message = 'Something went wrong', status = 500, errors = null) => {
  const body = {
    success: false,
    message,
  };

  if (errors) {
    body.errors = errors;
  }

  return res.status(status).json(body);
};

module.exports = { success, error, paginatedList };
