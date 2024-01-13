const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {

    const { search } = event.queryStringParameters || {};

    const baseParams = {
        TableName: 'platepad_ingredients',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': 'global' }
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
            body: JSON.stringify(data.Items.map(({ name, displayName, imageUrl, macro }) => ({
                name, displayName, imageUrl, macro
            })))
        });
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error)
        });
    }
};