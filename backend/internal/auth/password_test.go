package auth

import "testing"

func TestPasswordHashAndCheck(t *testing.T) {
	hash, err := HashPassword("s3cretpass")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if hash == "" || hash == "s3cretpass" {
		t.Fatal("hash should not be empty or plaintext")
	}
	if !CheckPassword(hash, "s3cretpass") {
		t.Fatal("correct password should verify")
	}
	if CheckPassword(hash, "wrong") {
		t.Fatal("wrong password should not verify")
	}
}
