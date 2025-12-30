FROM php:8.2-apache

# Install system dependencies and PHP extensions
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache mod_rewrite if needed (often useful for PHP apps)
RUN a2enmod rewrite

# Copy application source
COPY . /var/www/html/

# Set working directory
WORKDIR /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html
