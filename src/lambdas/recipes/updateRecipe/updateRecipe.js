const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const transformResponse = require('platePadResponseLayer');

exports.handler = async (event) => {
    const cognitoRole = event.requestContext.authorizer.claims["custom:role"];
    const userId = cognitoRole === "admin" ? "global" : event.requestContext.authorizer.claims.sub;

    const name = event.pathParameters.name;
    const { name: _, userId: __, ...recipeDetails } = JSON.parse(event.body);

    // Get existing recipe from DB
    const getParams = {
        TableName: 'platepad_recipes',
        Key: { 'userId': userId, 'name': name }
    };

    let existingItem;
    try {
        const data = await docClient.get(getParams).promise();
        if (data.Item) {
            existingItem = data.Item;
        } else {
            return transformResponse({
                statusCode: 404,
                body: JSON.stringify({ message: "Recipe not found" }),
            });
        }
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500,
            body: JSON.stringify(error),
        });
    }

    let ingredientsData = {};

    // Check if all ingredients exist, if ingredientValues is provided
    if (recipeDetails.ingredientValues) {
        const ingredientNames = recipeDetails.ingredientValues.map(iv => iv.ingredient);
        for (const ingredientName of ingredientNames) {
            const ingredientDataForUser = await docClient.query({
                TableName: 'platepad_ingredients',
                KeyConditionExpression: '#nameAttr = :n and userId = :u',
                ExpressionAttributeNames: { '#nameAttr': 'name' },
                ExpressionAttributeValues: { ':n': ingredientName, ':u': userId }
            }).promise();

            const ingredientDataGlobal = await docClient.query({
                TableName: 'platepad_ingredients',
                KeyConditionExpression: '#nameAttr = :n and userId = :g',
                ExpressionAttributeNames: { '#nameAttr': 'name' },
                ExpressionAttributeValues: { ':n': ingredientName, ':g': 'global' }
            }).promise();

            if (!ingredientDataForUser.Items.length && !ingredientDataGlobal.Items.length) {
                return transformResponse({
                    statusCode: 400,
                    body: JSON.stringify({ message: `Ingredient ${ingredientName} does not exist` }),
                });
            }

            // Use user-specific ingredient if available, else use global ingredient
            ingredientsData[ingredientName] = ingredientDataForUser.Items.length > 0 ?
                ingredientDataForUser.Items[0] : ingredientDataGlobal.Items[0];
        }
    }

    const getMacro = () => {
        let totalMacro = { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 };

        for (let iv of recipeDetails.ingredientValues) {
            let ingredientAmount = iv.amount;
            let ingredient = ingredientsData[iv.ingredient];
            let multiplier = ingredientAmount / 100; // as macros are given per 100g

            totalMacro.calories += (ingredient.macro.calories || 0) * multiplier;
            totalMacro.proteins += (ingredient.macro.proteins || 0) * multiplier;
            totalMacro.fats += (ingredient.macro.fats || 0) * multiplier;
            totalMacro.carbohydrates += (ingredient.macro.carbohydrates || 0) * multiplier;
        }

        // Round the values to integers
        totalMacro.calories = Math.round(totalMacro.calories);
        totalMacro.proteins = Math.round(totalMacro.proteins);
        totalMacro.fats = Math.round(totalMacro.fats);
        totalMacro.carbohydrates = Math.round(totalMacro.carbohydrates);

        return totalMacro;
    };

    // Update existing item with new details
    const updatedItem = { ...existingItem, ...recipeDetails, macro: getMacro() };

    // Save updated item back to DB
    const putParams = {
        TableName: 'platepad_recipes',
        Item: updatedItem
    };

    try {
        await docClient.put(putParams).promise();
        return transformResponse({
            statusCode: 204
        });
    } catch (error) {
        console.error(error);
        return transformResponse({
            statusCode: 500, body: JSON.stringify(error),
        });
    }
};