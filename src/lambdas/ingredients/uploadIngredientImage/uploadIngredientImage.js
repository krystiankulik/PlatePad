const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const name = event.pathParameters.name;
    const { sub: userId } = event.requestContext.authorizer.claims;
    const payload = JSON.parse(event.body);

    const imageBuffer = Buffer.from(payload.image, 'base64');

    // Fetch the ingredient from the database

    const getParams = {
        TableName: 'platepad_ingredients', Key: {
            'userId': userId, 'name': name
        }
    };

    let ingredient;
    try {
        const data = await docClient.get(getParams).promise();
        if (data.Item) {
            ingredient = data.Item;
        } else {
            return transformResponse({
                statusCode: 404, body: JSON.stringify({ message: "Ingredient not found" }),
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
        Key: `ingredients/${name}?t=${Date.now()}.jpg`,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
    };

    try {

        const uploadResponse = await s3.upload(params).promise();
        const imageUrl = uploadResponse.Location;

        ingredient.imageUrl = imageUrl;

        const putParams = {
            TableName: 'platepad_ingredients', Item: ingredient
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