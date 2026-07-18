"""Các router (nhóm endpoint) của API."""

from . import auth, classify, internal, meta, tickets

__all__ = ["auth", "tickets", "classify", "meta", "internal"]
