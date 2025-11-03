const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection string dari environment variable
const MONGODB_URI = process.env.MONGODB_URI;

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { action } = body;

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Action parameter is required' })
      };
    }

    // Connect to database
    const client = await connectToDatabase();
    const db = client.db('jadwal-pjr');
    const holidays = db.collection('holidays');

    switch (action) {
      case 'get_holidays':
        try {
          const holidayList = await holidays.find({}).toArray();
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(holidayList.map(h => ({
              id: h._id.toString(),
              date: h.date,
              reason: h.reason
            })))
          };
        } catch (error) {
          console.error('Error fetching holidays:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch holidays' })
          };
        }

      case 'add_holiday':
        try {
          const { date, reason } = body;

          if (!date || !reason) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Date and reason are required' })
            };
          }

          const result = await holidays.insertOne({
            date: date,
            reason: reason,
            createdAt: new Date()
          });

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              id: result.insertedId.toString()
            })
          };
        } catch (error) {
          console.error('Error adding holiday:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to add holiday' })
          };
        }

      case 'delete_holiday':
        try {
          const { id } = body;

          if (!id) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Holiday ID is required' })
            };
          }

          // Validate ObjectId format
          if (!ObjectId.isValid(id)) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Invalid holiday ID format' })
            };
          }

          const result = await holidays.deleteOne({ _id: new ObjectId(id) });

          if (result.deletedCount === 0) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Holiday not found' })
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
          };
        } catch (error) {
          console.error('Error deleting holiday:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to delete holiday' })
          };
        }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }
  } catch (error) {
    console.error('Database connection error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Database connection failed',
        details: error.message
      })
    };
  }
};
