// ignore_for_file: avoid_print
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'lib/firebase_options.dart';

void main() async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final auth = FirebaseAuth.instance;
  const password = 'Kurickal@2024';

  final users = [
    {'email': 'thomas@kurickaldevelopers.com', 'name': 'Thomas Kurickal'},
    {'email': 'ravi@kurickaldevelopers.com', 'name': 'Ravi Kumar'},
    {'email': 'arjun@kurickaldevelopers.com', 'name': 'Arjun Menon'},
    {'email': 'priya@kurickaldevelopers.com', 'name': 'Priya Nair'},
    {'email': 'suresh@kurickaldevelopers.com', 'name': 'Suresh Babu'},
    {'email': 'biju@kurickaldevelopers.com', 'name': 'Biju Pillai'},
    {'email': 'meena@kurickaldevelopers.com', 'name': 'Meena Raj'},
    {'email': 'anitha@kurickaldevelopers.com', 'name': 'Anitha Varghese'},
  ];

  for (final userData in users) {
    try {
      final email = userData['email']!;
      final name = userData['name']!;

      await auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      await auth.currentUser?.updateDisplayName(name);
      await auth.signOut();

      print('Created user: $email');
    } catch (e) {
      if (e is FirebaseAuthException && e.code == 'email-already-in-use') {
        print('User already exists: ${userData['email']}');
      } else {
        print('Error creating user ${userData['email']}: $e');
      }
    }
  }

  print('Done seeding dev users!');
}
