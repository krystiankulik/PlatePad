const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const { global, search } = event.queryStringParameters || {};
    const { sub: userId } = event.requestContext.authorizer.claims;

    const globalUserId = global === 'true' ? 'global' : userId;

    // Base query parameters
    const baseParams = {
        TableName: 'platepad_ingredients',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': globalUserId }
    };

    if (search) {
        const lowerSearch = search.toLowerCase();
        baseParams.FilterExpression = 'contains(displayNameLowerCase, :search)';
        baseParams.ExpressionAttributeValues[':search'] = lowerSearch;
    }

    try {
        const data = await docClient.query(baseParams).promise();
        return transformResponse({
            statusCode: 200,
            body: JSON.stringify(data.Items.map(({ name, displayName, macro }) => ({
                name, displayName, macro
            })))
        });
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error)
        });
    }
};