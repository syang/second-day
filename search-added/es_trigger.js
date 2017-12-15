var AWS = require('aws-sdk');
var path = require('path');

const qaSearchDomain = process.env.ES_DOMAIN;
let esDomain = {
    region: 'us-west-1',
    endpoint: 'search-backend-dev-searchdomain-jku36sqvljiz67awyicmg42ry4.us-west-1.es.amazonaws.com',
    index: 'q_a',
    doctype: 'questions'
};
var endpoint = new AWS.Endpoint(esDomain.endpoint);

exports.handler = function(event, context) {
    console.log("indexing is triggered", event.Records);
    console.log("esDomain: ", esDomain);

    // var es_endpoint = new AWS.Endpoint(qaSearchDomain);
    // assemble the document
    var documents = event.Records.map(function(record) {
        var data = {id : record.dynamodb.Keys.category.S + 
                         "-" + record.dynamodb.Keys.ts.S};      
        if (record.eventName === 'REMOVE') {
            data.type = 'delete'
        } else {
            var qa_entry = record.dynamodb.NewImage;
            data.type = 'add'
            data.fields = {
                question : qa_entry.question.S,
            };
            if (qa_entry.details != null) {
                data.fields.details = qa_entry.details.S
            }
        }
        console.log("generated data: ", data);
        return data;
    });
    console.log("document.fields = ", documents[0].fields);
    postToES(documents, context);
};

function postToES(documents, context) {
    doc = documents[0];
    var req = new AWS.HttpRequest(endpoint);
    req.method = 'PUT';
    req.path = path.join('/', esDomain.index, esDomain.doctype, doc.id);
    req.region = esDomain.region;
    // req.headers['presigned-expires'] = false;
    req.headers['Host'] = endpoint.host;
    req.body = JSON.stringify(doc.fields);
    console.log("request = ", req);
    console.log("request.body", req.body);

    // var signer = new AWS.Signers.V4(req , 'es');  // es: service code
    // signer.addAuthorization(creds, new Date());

    var send = new AWS.NodeHttpClient();
    send.handleRequest(req, null, function(httpResp) {
        var respBody = '';
        httpResp.on('data', function (chunk) {
            respBody += chunk;
        });
        httpResp.on('end', function (chunk) {
            console.log('Response: ' + respBody);
            context.succeed('Lambda added document ' + doc);
        });
    }, function(err) {
        console.log('Error: ' + err);
        context.fail('Lambda failed with error ' + err);
    });
}
