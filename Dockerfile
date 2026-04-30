# Use a combined Node and Python environment
FROM nikolaik/python-nodejs:python3.11-nodejs18

WORKDIR /app

# Install Python dependencies
COPY server/requirements.txt ./
RUN pip install -r requirements.txt

# Install Node dependencies
COPY server/package.json ./
RUN npm install

# Copy all code
COPY . .

# Expose ports for Node (3000) and FastAPI (8000)
EXPOSE 3000 8000

# Start both servers using a process manager or a simple shell script
CMD ["sh", "-c", "python server/ml_service.py & node server/server.js"]
