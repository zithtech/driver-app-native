export const TAMIL_NADU_CITIES = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur',
    'Vellore', 'Erode', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi',
    'Virudhunagar', 'Karur', 'Udhagamandalam', 'Hosur', 'Nagercoil', 'Kancheepuram',
    'Kumarapalayam', 'Karaikudi', 'Neyveli', 'Cuddalore', 'Kumbakonam', 'Pollachi',
    'Rajapalayam', 'Gudiyatham', 'Pudukkottai', 'Vaniyambadi', 'Ambur', 'Nagapattinam'
];

export const NORTH_INDIA_CITIES = [
    'Delhi', 'New Delhi', 'Gurgaon', 'Noida', 'Faridabad', 'Chandigarh', 'Ludhiana', 'Amritsar',
    'Jalandhar', 'Shimla', 'Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj',
    'Bareilly', 'Aligarh', 'Jammu', 'Srinagar', 'Dehradun', 'Haridwar'
];

export const WEST_INDIA_CITIES = [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Ahmedabad',
    'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Jaipur',
    'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Panaji', 'Vasco da Gama'
];

export const SOUTH_INDIA_CITIES = [
    'Bangalore', 'Mysore', 'Hubli', 'Dharwad', 'Mangalore', 'Belgaum', 'Hyderabad',
    'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar', 'Vijayawada', 'Visakhapatnam',
    'Guntur', 'Nellore', 'Kurnool', 'Trivandrum', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'
];

export const EAST_INDIA_CITIES = [
    'Kolkata', 'Howrah', 'Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Patna', 'Gaya',
    'Bhagalpur', 'Muzaffarpur', 'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'
];

export const CENTRAL_INDIA_CITIES = [
    'Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Raipur', 'Bhilai', 'Bilaspur'
];

export const NORTHEAST_INDIA_CITIES = [
    'Guwahati', 'Agartala', 'Shillong', 'Imphal', 'Aizawl', 'Kohima', 'Itanagar', 'Gangtok'
];

export const PUDUCHERRY_CITIES = [
    'Pondicherry', 'Oulgaret', 'Karaikal', 'Mahe', 'Yanam'
];

const OTHER_STATES = [
    'Andaman and Nicobar Islands',
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chandigarh',
    'Chhattisgarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jammu and Kashmir',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Ladakh',
    'Lakshadweep',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Puducherry',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal'
].sort();

export const ALL_STATES = ['Tamil Nadu', ...OTHER_STATES];

const OTHER_INDIAN_CITIES = [
    ...NORTH_INDIA_CITIES,
    ...WEST_INDIA_CITIES,
    ...SOUTH_INDIA_CITIES,
    ...EAST_INDIA_CITIES,
    ...CENTRAL_INDIA_CITIES,
    ...NORTHEAST_INDIA_CITIES,
    ...PUDUCHERRY_CITIES
].sort();

export const ALL_CITIES = [
    ...TAMIL_NADU_CITIES.sort(),
    ...OTHER_INDIAN_CITIES
];

export const TAMIL_NADU_DISTRICTS = [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
    'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Karur', 'Krishnagiri',
    'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
    'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem',
    'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi',
    'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur',
    'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'
];

export const OTHER_DISTRICTS = [
    'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Hyderabad', 'Rangareddy',
    'Ernakulam', 'Thiruvananthapuram', 'Thrissur', 'Kozhikode',
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Ahmedabad', 'Surat', 'Vadodara',
    'New Delhi', 'Gurugram', 'Ghaziabad', 'Lucknow', 'Kanpur',
    'Kolkata', 'Howrah', 'Patna', 'Ranchi', 'Bhubaneswar',
    'Bhopal', 'Indore', 'Jaipur', 'Jodhpur', 'Raipur',
    'Guwahati', 'Chandigarh'
].sort();

export const ALL_DISTRICTS = [
    ...TAMIL_NADU_DISTRICTS.sort(),
    ...OTHER_DISTRICTS
];
