'use strict';

const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

const questionTableName = process.env.DYNAMODB_QUESTIONS_TABLE;
const answerTableName = process.env.DYNAMODB_ANSWERS_TABLE;


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
  var parsed_question = JSON.parse(event.body).question;
  var parsed_details = JSON.parse(event.body).details;

  console.log("category: ", parsed_category);
  console.log("question title", parsed_question);
  console.log("parsed_details:", parsed_details);
  let item = {
    category: parsed_category,
    ts: timestamp,
    question: parsed_question
  };
  parsed_details && (item.details = parsed_details)
  console.log("event.body is json: ", typeof event.body == 'object');
  console.log("even.body: ", event.body);
  console.log("item.question is json: ", typeof item.question == 'object');
  console.log("item:", item);

  let params = {
    TableName: questionTableName,
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
  var parsed_lastevaluated = 
      event.queryStringParameters.last_question_id;
  
  var params = {
      TableName : questionTableName,
      Limit: event.queryStringParameters.limit, // retrun how many client asks for
      ScanIndexForward: false, // latest entry first
      KeyConditionExpression: "#category = :category",
      ExpressionAttributeNames:{
          "#category": "category"
      },
      ExpressionAttributeValues: {
          ":category": event.queryStringParameters.category
      }
  };
  parsed_lastevaluated && (params.ExclusiveStartKey = 
    {
      "category": parsed_lastevaluated.split("-")[0],
      "ts": parsed_lastevaluated.split("-")[1]
    }
  );
  
  let dbQuery = (params) => {
    // return dynamo.get(params).promise()
    return dynamo.query(params).promise()
  };

  dbQuery(params).then((data) => {
    console.log(data);
    if (!data.Items) {
      callback(null, createResponseWithHeader(404, "ITEM NOT FOUND"));
    }
    data.Items.forEach(function(item) {
        item.id = item.category + "-" + item.ts;
        delete item.category;
        delete item.ts;
    });
    delete data.ScannedCount;

    // TODO: ask Song to change his client side code
    callback(null, createResponseWithHeader(200, JSON.stringify(
      {"questions":data.Items, 
       "count":data.Count, 
       "last_question_id":data.LastEvaluatedKey.category + "-" + data.LastEvaluatedKey.ts}
      )));
    // callback(null, createResponseWithHeader(200, JSON.stringify(data.Items)));  
  }).catch((err) => {
    console.log(`GET ITEM FAILED FOR doc, WITH ERROR: ${err}`);
    callback(null, createResponseWithHeader(500, err));
  });
};

exports.postAnswer = (event, context, callback) => {
  console.log("Whole request: " + JSON.stringify(event));
  console.log("postAnswer --> event.body content: ", event.body);
  console.log("event.pathParameters.questionId", event.pathParameters.questionId);
  let item = {
    qid: event.pathParameters.questionId,
    // Date.now() returns the milliseconds elapsed since 1 January 1970 00:00:00 UTC
    ts: Date.now().toString(),
    answer: JSON.parse(event.body).answer
  };
  let params = {
    TableName: answerTableName,
    Item: item
  };

  let dbPut = (params) => {
    return dynamo.put(params).promise()
  };

  dbPut(params).then((data) => {
    console.log(`PUT ITEM SUCCEEDED WITH quetion = ${item.answer}`);
    callback(null, createResponseWithHeader(200, JSON.stringify(item)));
  }).catch((err) => {
    console.log(`PUT ITEM FAILED FOR doc = ${item.answer}, WITH ERROR: ${err}`);
    callback(null, createResponseWithHeader(500, err));
  });
};

exports.getQuestionDetails = (event, context, callback) => {
  var keys = event.pathParameters.questionId.split("-");
  console.log("keys: ", keys);
  var result = {};

  // Let first query the question table and retrive the question
  let params = {
    TableName: questionTableName,
    Key: {
      category: keys[0],
      ts: keys[1]
    }
  };
  // Let then query the answer table and retrive the list of answers (or empty)
  let params_query = {
      TableName : answerTableName,
      KeyConditionExpression: "#yr = :yyyy",
      ExpressionAttributeNames:{
          "#yr": "qid"
      },
      ExpressionAttributeValues: {
          ":yyyy":event.pathParameters.questionId
      }
  };

  // Define the two promises and later chain them together
  let dbGet = (params) => {
    return dynamo.get(params).promise()
  };
  let dbQuery = (params) => {
    // return dynamo.get(params).promise()
    return dynamo.query(params).promise()
  };

  dbGet(params).then((data) => {
    if (!data.Item) {
      callback(null, createResponseWithHeader(404, "ITEM NOT FOUND"));
    }
    result.question = JSON.parse(JSON.stringify(data.Item.question));
    console.log("result.question: ", result.question);
    return dbQuery(params_query);
  }).then((data) => {
    if (!data.Items) {
      // there exist no answers, but there exist question because of dbGet
      // comes here already
      callback(null, createResponseWithHeader(200, JSON.stringify(result)));
    }
    result.answers = JSON.parse(JSON.stringify(data.Items));
    console.log("result.answers: ", result.answers);
    callback(null, createResponseWithHeader(200, JSON.stringify(result)));
  }).catch((err) => {
    console.log(`getQuestionDetails $event.pathParameters.questionId, WITH ERROR: ${err}`);
    callback(null, createResponseWithHeader(500, err));
  });
};
