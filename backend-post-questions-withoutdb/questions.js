'use strict';

module.exports.postQuestion = (event, context, callback) => {
  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    },
    body: JSON.stringify({
      message: 'We will fill in logic serving POST /questions here',
      input: event,
    }),
  };

  callback(null, response);
};
