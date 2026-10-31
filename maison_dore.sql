-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 31, 2026 at 07:12 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `maison_dore`
--

-- --------------------------------------------------------

--
-- Table structure for table `addresses`
--

CREATE TABLE `addresses` (
  `user_id` int(11) NOT NULL,
  `country` varchar(80) NOT NULL,
  `city` varchar(80) NOT NULL,
  `street` varchar(120) NOT NULL,
  `house` varchar(20) NOT NULL,
  `apartment` varchar(20) DEFAULT NULL,
  `postal_code` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(80) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`) VALUES
(1, 'Breakfast', 'breakfast', 1),
(2, 'Brunch', 'brunch', 2),
(3, 'Starters', 'starters', 3),
(4, 'Soups', 'soups', 4),
(5, 'Salads', 'salads', 5),
(6, 'Appetizers', 'appetizers', 6),
(7, 'Main Courses', 'main-courses', 7),
(8, 'Pasta', 'pasta', 8),
(9, 'Pizza', 'pizza', 9),
(10, 'Burgers', 'burgers', 10),
(11, 'Sandwiches', 'sandwiches', 11),
(12, 'Steaks', 'steaks', 12),
(13, 'Grilled Meat', 'grilled-meat', 13),
(14, 'Chicken', 'chicken', 14),
(15, 'Beef', 'beef', 15),
(16, 'Pork', 'pork', 16),
(17, 'Lamb', 'lamb', 17),
(18, 'Fish', 'fish', 18),
(19, 'Seafood', 'seafood', 19),
(20, 'Sushi', 'sushi', 20),
(21, 'Vegetarian', 'vegetarian', 21),
(22, 'Vegan', 'vegan', 22),
(23, 'Side Dishes', 'side-dishes', 23),
(24, 'Sauces & Dips', 'sauces-dips', 24),
(25, 'Desserts', 'desserts', 25),
(26, 'Cakes & Pastries', 'cakes-pastries', 26),
(27, 'Ice Cream', 'ice-cream', 27),
(28, 'Fruit', 'fruit', 28),
(29, 'Coffee', 'coffee', 29),
(30, 'Tea', 'tea', 30),
(31, 'Soft Drinks', 'soft-drinks', 31),
(32, 'Fresh Juices', 'fresh-juices', 32),
(33, 'Smoothies', 'smoothies', 33),
(34, 'Milkshakes', 'milkshakes', 34),
(35, 'Cocktails', 'cocktails', 35),
(36, 'Wine', 'wine', 36),
(37, 'Beer', 'beer', 37),
(38, 'Spirits', 'spirits', 38),
(39, 'Non-Alcoholic Drinks', 'non-alcoholic-drinks', 39),
(40, 'Kids Menu', 'kids-menu', 40),
(41, 'Chef’s Specials', 'chefs-specials', 41),
(42, 'Seasonal Specials', 'seasonal-specials', 42),
(43, 'Special Offers', 'special-offers', 43);

-- --------------------------------------------------------

--
-- Table structure for table `dishes`
--

CREATE TABLE `dishes` (
  `id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` varchar(500) NOT NULL,
  `price` decimal(8,2) NOT NULL,
  `image` varchar(500) NOT NULL,
  `available` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `dishes`
--

INSERT INTO `dishes` (`id`, `category_id`, `name`, `description`, `price`, `image`, `available`, `created_at`, `updated_at`) VALUES
(1, 14, 'Bang bang chiken', '**Bang Bang Chicken** — crispy, juicy chicken coated in a creamy, sweet and spicy bang bang sauce. A perfect balance of crunch, richness, and a subtle kick.', 10.00, 'https://i.pinimg.com/1200x/28/30/a0/2830a0077987a7196f4d6a7023806ed7.jpg', 1, '2026-10-06 17:45:03', '2026-10-06 17:45:03');

-- --------------------------------------------------------

--
-- Table structure for table `favorites`
--

CREATE TABLE `favorites` (
  `user_id` int(11) NOT NULL,
  `dish_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `customer_name` varchar(170) NOT NULL,
  `order_type` enum('delivery','restaurant') NOT NULL,
  `status` enum('pending','accepted','preparing','ready','out_for_delivery','completed','cancelled') NOT NULL DEFAULT 'pending',
  `subtotal` decimal(10,2) NOT NULL,
  `delivery_fee` decimal(8,2) NOT NULL DEFAULT 0.00,
  `total_price` decimal(10,2) NOT NULL,
  `table_number` smallint(6) DEFAULT NULL,
  `ship_country` varchar(80) DEFAULT NULL,
  `ship_city` varchar(80) DEFAULT NULL,
  `ship_street` varchar(120) DEFAULT NULL,
  `ship_house` varchar(20) DEFAULT NULL,
  `ship_apartment` varchar(20) DEFAULT NULL,
  `ship_postal` varchar(20) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `user_id`, `customer_name`, `order_type`, `status`, `subtotal`, `delivery_fee`, `total_price`, `table_number`, `ship_country`, `ship_city`, `ship_street`, `ship_house`, `ship_apartment`, `ship_postal`, `created_at`, `updated_at`) VALUES
(1001, NULL, 'Client Client', 'restaurant', 'completed', 60.00, 0.00, 60.00, 3, NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-06 18:07:15', '2026-10-06 18:07:46'),
(1002, NULL, 'Client Client', 'delivery', 'completed', 40.00, 5.00, 45.00, NULL, 'Poland', 'Warsaw', 'Street', '67', NULL, '05-300', '2026-10-06 18:08:49', '2026-10-06 18:09:00');

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `dish_id` int(11) DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `image` varchar(500) NOT NULL,
  `unit_price` decimal(8,2) NOT NULL,
  `quantity` smallint(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `dish_id`, `name`, `image`, `unit_price`, `quantity`) VALUES
(1, 1001, 1, 'Bang bang chiken', 'https://i.pinimg.com/1200x/28/30/a0/2830a0077987a7196f4d6a7023806ed7.jpg', 10.00, 6),
(2, 1002, 1, 'Bang bang chiken', 'https://i.pinimg.com/1200x/28/30/a0/2830a0077987a7196f4d6a7023806ed7.jpg', 10.00, 4);

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `setting_key` varchar(60) NOT NULL,
  `setting_value` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(100) DEFAULT NULL,
  `google_id` varchar(64) DEFAULT NULL,
  `avatar` varchar(500) DEFAULT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `role` enum('client','worker','admin') NOT NULL DEFAULT 'client',
  `blocked` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `addresses`
--
ALTER TABLE `addresses`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `dishes`
--
ALTER TABLE `dishes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `favorites`
--
ALTER TABLE `favorites`
  ADD PRIMARY KEY (`user_id`,`dish_id`),
  ADD KEY `dish_id` (`dish_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_orders_user` (`user_id`),
  ADD KEY `idx_orders_status` (`status`),
  ADD KEY `idx_orders_created` (`created_at`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `dish_id` (`dish_id`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `google_id` (`google_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

--
-- AUTO_INCREMENT for table `dishes`
--
ALTER TABLE `dishes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1003;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `addresses`
--
ALTER TABLE `addresses`
  ADD CONSTRAINT `addresses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `dishes`
--
ALTER TABLE `dishes`
  ADD CONSTRAINT `dishes_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`);

--
-- Constraints for table `favorites`
--
ALTER TABLE `favorites`
  ADD CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `favorites_ibfk_2` FOREIGN KEY (`dish_id`) REFERENCES `dishes` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`dish_id`) REFERENCES `dishes` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
