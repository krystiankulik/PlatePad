const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const name = event.pathParameters.name;

    const cognitoRole = event.requestContext.authorizer.claims["custom:role"];
    const userId = cognitoRole === "admin" ? "global" : event.requestContext.authorizer.claims.sub;

    const payload = JSON.parse(event.body);

    const imageBuffer = Buffer.from(payload.image, 'base64');

    const getParams = {
        TableName: 'platepad_recipes', Key: {
            'userId': userId, 'name': name
        }
    };

    let recipe;
    try {
        const data = await docClient.get(getParams).promise();
        if (data.Item) {
            recipe = data.Item;
        } else {
            return transformResponse({
                statusCode: 404, body: JSON.stringify({ message: "Recipe not found" }),
            });
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error),
        });
    }


    // Define S3 parameters
    const params = {
        Bucket: 'plate-pad-images-bucket',
        Key: `recipes/${name}.jpg?t=${Date.now()}`,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
    };

    try {

        const uploadResponse = await s3.upload(params).promise();
        const imageUrl = uploadResponse.Location;

        recipe.imageUrl = imageUrl;

        const putParams = {
            TableName: 'platepad_recipes', Item: recipe
        };

        await docClient.put(putParams).promise();
        return transformResponse({
            statusCode: 200,
            body: JSON.stringify({ imageUrl: imageUrl })
        });


    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message }),
        };
    }
}