-- Run this in your Supabase SQL Editor to fill the leaderboard with random past winners
-- with various prize tiers ($5K to $150K)

INSERT INTO giveaway_winners (user_id, full_name, country, account_size, draw_date) VALUES 
(null, 'Ahmed Al-Rashid', 'UAE', '$150,000', current_date - interval '1 day'),
(null, 'Carlos Mendez', 'Mexico', '$25,000', current_date - interval '1 day'),
(null, 'Liam O''Brien', 'Ireland', '$5,000', current_date - interval '2 days'),
(null, 'Sofia Novak', 'Poland', '$50,000', current_date - interval '2 days'),
(null, 'Yusuf Ibrahim', 'Nigeria', '$100,000', current_date - interval '3 days'),
(null, 'Alex Kowalski', 'Poland', '$5,000', current_date - interval '4 days'),
(null, 'Elena Popescu', 'Romania', '$150,000', current_date - interval '5 days'),
(null, 'Fatima Al-Zahra', 'Morocco', '$25,000', current_date - interval '6 days'),
(null, 'Mohammed Al-Farsi', 'Oman', '$50,000', current_date - interval '7 days'),
(null, 'Rahul Patel', 'India', '$100,000', current_date - interval '8 days'),
(null, 'Amina Diallo', 'Senegal', '$5,000 Unlimited', current_date - interval '9 days'),
(null, 'Ivan Petrov', 'Bulgaria', '$25,000', current_date - interval '10 days'),
(null, 'Omar Abdullah', 'Saudi Arabia', '$150,000', current_date - interval '11 days'),
(null, 'Samuel Asante', 'Ghana', '$50,000', current_date - interval '12 days'),
(null, 'Julia Martins', 'Portugal', '$100,000', current_date - interval '13 days'),
(null, 'Nadia Hassan', 'Egypt', '$5,000', current_date - interval '14 days'),
(null, 'Rania Khalil', 'Jordan', '$25,000', current_date - interval '15 days'),
(null, 'Aisha Mohammed', 'Bangladesh', '$150,000', current_date - interval '16 days'),
(null, 'Zara Ahmed', 'UK', '$50,000', current_date - interval '17 days'),
(null, 'Deepak Verma', 'India', '$5,000 Unlimited', current_date - interval '18 days'),
(null, 'Tunde Adeyemi', 'Nigeria', '$100,000', current_date - interval '19 days'),
(null, 'Vikram Singh', 'India', '$25,000', current_date - interval '20 days'),
(null, 'Kevin Otieno', 'Kenya', '$150,000', current_date - interval '21 days'),
(null, 'Amara Traoré', 'Ivory Coast', '$50,000', current_date - interval '22 days'),
(null, 'Riya Desai', 'India', '$5,000', current_date - interval '23 days');
