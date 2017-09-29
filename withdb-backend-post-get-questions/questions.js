'use strict';

const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

const tableName = process.env.DYNAMODB_QUESTIONS_TABLE;

const createResponse = (statusCode, body) => {
  // console.log("inside createResponse, body = ", body);
  return {
    statusCode: statusCode,
    body: body
  }
};

const createResponseWithHeader = (statusCode, body) => {
  // console.log("inside createResponseWithHeader, body = ", body);
  let headerString = {
    "Content-Type": 'application/json',
    "Access-Control-Allow-Origin": '*'
  };
  return {
    statusCode: statusCode,
    headers: headerString,
    body: body
  }
};


module.exports.postQuestion = (event, context, callback) => {
  var timestamp = Date.now().toString();
  var parsed_category = JSON.parse(event.body).category;

  console.log("category: ", parsed_category);
  console.log("body:", event.body);
  let item = {
    category: parsed_category,
    ts: timestamp,
    question: JSON.parse(event.body)
  };
  console.log("event.body is json: ", typeof event.body == 'object');
  console.log("even.body: ", event.body);
  console.log("item.question is json: ", typeof item.question == 'object');
  console.log("item:", item);

  let params = {
    TableName: tableName,
    Item: item
  };

  let dbPut = (params) => {
    return dynamo.put(params).promise()
  };

  dbPut(params).then((data) => {
    console.log("PUT ITEM SUCCEEDED WITH");
    let return_body = {
      id: parsed_category + "-" + timestamp,
      question: JSON.parse(event.body)
    };
    callback(null, createResponseWithHeader(200, JSON.stringify(return_body)));
  }).catch((err) => {
    console.log(`PUT ITEM FAILED FOR doc = ${item.question}, WITH ERROR: ${err}`);
    callback(null, createResponseWithHeader(500, err));
  });
};

module.exports.queryQuestionList = (event, context, callback) => {
  console.log("query parameters: ", event.queryStringParameters);
  var params = {
      TableName : tableName,
      // Limit: event.queryStringParameters.limit,
      ScanIndexForward: false,
      KeyConditionExpression: "#category = :category",
      ExpressionAttributeNames:{
          "#category": "category"
      },
      ExpressionAttributeValues: {
          ":category": event.queryStringParameters.category
      }

  };
  let dbQuery = (params) => {
    // return dynamo.get(params).promise()
    return dynamo.query(params).promise()
  };

  dbQuery(params).then((data) => {
    // console.log(data);
    if (!data.Items) {
      callback(null, createResponseWithHeader(404, "ITEM NOT FOUND"));
    }
    data.Items.forEach(function(item) {
        item.id = item.category + "-" + item.ts;
        delete item.category;
        delete item.ts;
    });
    callback(null, createResponseWithHeader(200, JSON.stringify(data.Items)));
  }).catch((err) => {
    console.log(`GET ITEM FAILED FOR doc, WITH ERROR: ${err}`);
    callback(null, createResponseWithHeader(500, err));
  });
};
