const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const {global} = event.queryStringParameters || {};
    const {sub: userId} = event.requestContext.authorizer.claims;

    const globalUserId = global === 'true' ? 'global' : userId;

    const params = {
        TableName: 'platepad_ingredients',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {':userId': globalUserId}
    };

    try {
        const data = await docClient.query(params).promise();
        return {
            statusCode: 200, body: JSON.stringify(data.Items.map(({name, displayName, macro}) => ({
                name, displayName, macro
            })))
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500, body: JSON.stringify(error)
        };
    }
};