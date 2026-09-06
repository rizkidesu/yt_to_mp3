FROM python:3.11-slim

# Install ffmpeg for audio extraction and conversion to MP3
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY apps.py /app/
COPY templates/ /app/templates/
COPY static/ /app/static/

EXPOSE 5000

CMD ["python", "apps.py"]
